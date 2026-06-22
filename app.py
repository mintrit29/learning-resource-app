import streamlit as st
import fitz  # PyMuPDF
import sqlite3
import requests
import json
import re
import math
import unicodedata
import os
from difflib import SequenceMatcher
from datetime import datetime


DB_NAME = "documents.db"
PREVIEW_LIMIT = 5000

# Custom OpenAI-compatible API
API_BASE_URL = os.getenv("CUSTOM_API_BASE_URL", "http://localhost:8000/v1")
API_CHAT_URL = f"{API_BASE_URL}/chat/completions"
API_MODEL = os.getenv("CUSTOM_API_MODEL", "your-chat-model")

API_KEY = os.getenv("CUSTOM_API_KEY", "")

# Gửi tối đa khoảng 100k ký tự/lần phân tích.
# Nếu tài liệu lớn hơn thì code sẽ tự chunk và loop nhiều lần.
ANALYSIS_CHUNK_CHAR_LIMIT = 100000
ANALYSIS_CHUNK_OVERLAP = 1500


TOPIC_OPTIONS = [
    "Tất cả",
    "Artificial Intelligence",
    "Machine Learning",
    "Database",
    "Cybersecurity",
    "Web Development",
    "Software Engineering",
    "Computer Networks",
    "Mathematics",
    "Data Science",
    "Language Learning",
    "Other"
]

DIFFICULTY_OPTIONS = [
    "Tất cả",
    "Beginner",
    "Intermediate",
    "Advanced"
]


ALLOWED_TOPICS = [
    "Artificial Intelligence",
    "Machine Learning",
    "Database",
    "Cybersecurity",
    "Web Development",
    "Software Engineering",
    "Computer Networks",
    "Mathematics",
    "Data Science",
    "Language Learning",
    "Other"
]

ALLOWED_DIFFICULTIES = [
    "Beginner",
    "Intermediate",
    "Advanced"
]


def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            text_content TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def add_column_if_not_exists(column_name, column_type):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(documents)")
    existing_columns = [column[1] for column in cursor.fetchall()]

    if column_name not in existing_columns:
        cursor.execute(f"""
            ALTER TABLE documents
            ADD COLUMN {column_name} {column_type}
        """)

    conn.commit()
    conn.close()


def upgrade_db():
    add_column_if_not_exists("topic", "TEXT")
    add_column_if_not_exists("difficulty", "TEXT")
    add_column_if_not_exists("summary", "TEXT")
    add_column_if_not_exists("keywords", "TEXT")


def save_document(file_name, text_content):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO documents (
            file_name,
            text_content,
            topic,
            difficulty,
            summary,
            keywords,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        file_name,
        text_content,
        None,
        None,
        None,
        None,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))

    conn.commit()
    conn.close()


def update_document_ai_result(document_id, topic, difficulty, summary, keywords):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE documents
        SET topic = ?,
            difficulty = ?,
            summary = ?,
            keywords = ?
        WHERE id = ?
    """, (
        topic,
        difficulty,
        summary,
        keywords,
        document_id
    ))

    conn.commit()
    conn.close()


def get_document_count():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM documents")
    count = cursor.fetchone()[0]

    conn.close()

    return count


def get_all_documents_for_search():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            id,
            file_name,
            topic,
            difficulty,
            created_at,
            summary,
            keywords,
            text_content
        FROM documents
        ORDER BY id DESC
    """)

    documents = cursor.fetchall()
    conn.close()

    return documents


def get_document_by_id(document_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            id,
            file_name,
            text_content,
            topic,
            difficulty,
            summary,
            keywords,
            created_at
        FROM documents
        WHERE id = ?
    """, (document_id,))

    document = cursor.fetchone()
    conn.close()

    return document


def delete_document(document_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("PRAGMA secure_delete = ON")

    cursor.execute("""
        DELETE FROM documents
        WHERE id = ?
    """, (document_id,))

    cursor.execute("SELECT COUNT(*) FROM documents")
    document_count = cursor.fetchone()[0]

    if document_count == 0:
        cursor.execute("""
            DELETE FROM sqlite_sequence
            WHERE name = 'documents'
        """)

    conn.commit()
    cursor.execute("VACUUM")
    conn.close()


def extract_text_from_pdf(uploaded_file):
    text = ""

    uploaded_file.seek(0)

    pdf_bytes = uploaded_file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    total_pages = len(doc)

    for page_number, page in enumerate(doc, start=1):
        page_text = page.get_text()

        text += f"\n\n--- Page {page_number} ---\n\n"
        text += page_text

    doc.close()

    return text, total_pages


def show_value(value, default_text="Chưa có"):
    if value is None or str(value).strip() == "":
        return default_text

    return value


def normalize_text(text):
    if text is None:
        return ""

    text = str(text).lower()

    # Bỏ dấu tiếng Việt để search dễ hơn
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")

    # Chuẩn hóa ký tự đặc biệt
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


def tokenize_query(query):
    normalized_query = normalize_text(query)

    tokens = re.findall(r"[a-z0-9]+", normalized_query)

    expanded_tokens = []

    synonym_map = {
        "ai": ["ai", "artificial", "intelligence"],
        "ml": ["ml", "machine", "learning"],
        "dl": ["dl", "deep", "learning"],
        "db": ["db", "database", "sql"],
        "sql": ["sql", "database", "query"],
        "nn": ["nn", "neural", "network"],
        "nlp": ["nlp", "language", "processing"],
        "web": ["web", "frontend", "backend"],
        "js": ["js", "javascript"],
        "oop": ["oop", "object", "oriented", "programming"],
        "network": ["network", "networks", "computer", "networking"],
        "security": ["security", "cybersecurity", "attack"],
        "math": ["math", "mathematics"],
    }

    for token in tokens:
        expanded_tokens.append(token)

        if token in synonym_map:
            expanded_tokens.extend(synonym_map[token])

    # Bỏ trùng, giữ thứ tự
    unique_tokens = []
    for token in expanded_tokens:
        if token not in unique_tokens:
            unique_tokens.append(token)

    return unique_tokens


def fuzzy_match_score(token, text, max_words_to_check=200):
    """
    Fuzzy nhẹ cho metadata. Không dùng quá nặng cho toàn bộ text_content.
    """
    if not token or not text:
        return 0

    words = list(set(re.findall(r"[a-z0-9]+", text)))[:max_words_to_check]

    best_score = 0

    for word in words:
        ratio = SequenceMatcher(None, token, word).ratio()

        if ratio > best_score:
            best_score = ratio

    if best_score >= 0.9:
        return 2

    if best_score >= 0.8:
        return 1

    return 0


def calculate_search_score(query, document):
    """
    document tuple:
    id, file_name, topic, difficulty, created_at, summary, keywords, text_content
    """

    (
        doc_id,
        file_name,
        topic,
        difficulty,
        created_at,
        summary,
        keywords,
        text_content
    ) = document

    normalized_query = normalize_text(query)
    query_tokens = tokenize_query(query)

    if not normalized_query.strip():
        return 1

    fields = [
        ("file_name", normalize_text(file_name), 12),
        ("topic", normalize_text(topic), 15),
        ("difficulty", normalize_text(difficulty), 8),
        ("summary", normalize_text(summary), 10),
        ("keywords", normalize_text(keywords), 18),
        ("text_content", normalize_text(text_content), 2),
    ]

    score = 0

    for field_name, field_text, weight in fields:
        if not field_text:
            continue

        # Match nguyên cụm vẫn được điểm cao
        if normalized_query in field_text:
            score += weight * 10

        for token in query_tokens:
            if len(token) < 2:
                continue

            if token in field_text:
                score += weight * 2

            # Prefix match: gõ "mach" vẫn bắt được "machine"
            words = field_text.split()

            if field_name != "text_content":
                if any(word.startswith(token) for word in words):
                    score += weight

                # Fuzzy match nhẹ cho metadata
                score += fuzzy_match_score(token, field_text) * weight

    return score


def search_documents(search_query="", topic_filter="Tất cả", difficulty_filter="Tất cả"):
    documents = get_all_documents_for_search()

    results = []

    for document in documents:
        (
            doc_id,
            file_name,
            topic,
            difficulty,
            created_at,
            summary,
            keywords,
            text_content
        ) = document

        if topic_filter != "Tất cả" and topic != topic_filter:
            continue

        if difficulty_filter != "Tất cả" and difficulty != difficulty_filter:
            continue

        score = calculate_search_score(search_query, document)

        if search_query.strip():
            if score <= 0:
                continue

        results.append({
            "id": doc_id,
            "file_name": file_name,
            "topic": topic,
            "difficulty": difficulty,
            "created_at": created_at,
            "score": score
        })

    results.sort(key=lambda item: (item["score"], item["id"]), reverse=True)

    return results


def split_text_into_chunks(text, chunk_size=ANALYSIS_CHUNK_CHAR_LIMIT, overlap=ANALYSIS_CHUNK_OVERLAP):
    text = text.strip()

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(0, end - overlap)

    return chunks


def get_api_headers():
    headers = {
        "Content-Type": "application/json"
    }

    if API_KEY.strip():
        headers["Authorization"] = f"Bearer {API_KEY.strip()}"

    return headers


def extract_content_from_api_result(result):
    choices = result.get("choices", [])

    if not choices:
        return ""

    first_choice = choices[0]

    message = first_choice.get("message", {})
    content = message.get("content", "")

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts = []

        for item in content:
            if isinstance(item, dict):
                if "text" in item:
                    parts.append(str(item["text"]))
                elif "content" in item:
                    parts.append(str(item["content"]))
            else:
                parts.append(str(item))

        return "\n".join(parts)

    if "text" in first_choice:
        return str(first_choice["text"])

    return ""


def call_custom_chat(messages, max_tokens=2000):
    payload = {
        "model": API_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": max_tokens,
        "stream": False
    }

    response = requests.post(
        API_CHAT_URL,
        headers=get_api_headers(),
        json=payload,
        timeout=300
    )

    if response.status_code != 200:
        raise Exception(f"Custom API lỗi HTTP {response.status_code}: {response.text}")

    return response.json()


def clean_ai_response(response_text):
    response_text = response_text.strip()

    response_text = re.sub(
        r"<think>.*?</think>",
        "",
        response_text,
        flags=re.DOTALL
    ).strip()

    response_text = response_text.replace("```json", "")
    response_text = response_text.replace("```", "")
    response_text = response_text.strip()

    return response_text


def parse_ai_json(response_text):
    cleaned_text = clean_ai_response(response_text)

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        pass

    json_match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)

    if json_match:
        json_text = json_match.group(0)

        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"AI không trả về JSON hợp lệ. Nội dung AI trả về: {response_text}")


def normalize_topic(topic):
    if topic in ALLOWED_TOPICS:
        return topic

    return "Other"


def normalize_difficulty(difficulty):
    if difficulty in ALLOWED_DIFFICULTIES:
        return difficulty

    return "Intermediate"


def build_single_analysis_prompt(file_name, text_content):
    prompt = f"""
Bạn là AI phân tích học liệu cho hệ thống Smart Learning Resources Management.

Nhiệm vụ:
Đọc nội dung tài liệu được trích xuất từ PDF, sau đó phân tích và trả về JSON.

Yêu cầu rất quan trọng:
- Chỉ trả về JSON hợp lệ.
- Không dùng markdown.
- Không giải thích ngoài JSON.
- Không thêm ```json.
- Không thêm chữ nào trước hoặc sau JSON.
- Summary phải viết bằng tiếng Việt.
- Keywords có thể là tiếng Anh hoặc tiếng Việt tùy nội dung tài liệu.
- Hãy xuất nhiều keywords, khoảng 15 đến 25 keywords.

Danh sách topic hợp lệ:
- Artificial Intelligence
- Machine Learning
- Database
- Cybersecurity
- Web Development
- Software Engineering
- Computer Networks
- Mathematics
- Data Science
- Language Learning
- Other

Danh sách difficulty hợp lệ:
- Beginner
- Intermediate
- Advanced

Quy tắc đánh giá difficulty:
- Beginner: tài liệu nhập môn, dễ hiểu, nhiều khái niệm cơ bản, phù hợp người mới.
- Intermediate: cần kiến thức nền, có thuật ngữ chuyên môn, có ví dụ hoặc lý thuyết mức vừa.
- Advanced: tài liệu nghiên cứu, nhiều thuật toán, công thức, thí nghiệm, lý thuyết nặng hoặc yêu cầu nền tảng sâu.

Trả về đúng JSON format này:
{{
  "topic": "Other",
  "difficulty": "Beginner",
  "summary": "Tóm tắt tiếng Việt trong 5 đến 8 câu.",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8", "keyword 9", "keyword 10", "keyword 11", "keyword 12", "keyword 13", "keyword 14", "keyword 15"]
}}

Tên file:
{file_name}

Nội dung tài liệu:
\"\"\"
{text_content}
\"\"\"
"""

    return prompt


def build_chunk_analysis_prompt(file_name, chunk_text, chunk_index, total_chunks):
    prompt = f"""
Bạn là AI phân tích học liệu cho hệ thống Smart Learning Resources Management.

Đây là chunk {chunk_index}/{total_chunks} của một tài liệu PDF dài.

Nhiệm vụ:
Phân tích riêng chunk này và trả về JSON.

Yêu cầu:
- Chỉ trả về JSON hợp lệ.
- Không dùng markdown.
- Không giải thích ngoài JSON.
- Summary viết bằng tiếng Việt.
- Keywords xuất khoảng 15 đến 25 keywords nếu có đủ thông tin.

Topic hợp lệ:
- Artificial Intelligence
- Machine Learning
- Database
- Cybersecurity
- Web Development
- Software Engineering
- Computer Networks
- Mathematics
- Data Science
- Language Learning
- Other

Difficulty hợp lệ:
- Beginner
- Intermediate
- Advanced

Trả về đúng JSON format này:
{{
  "topic_candidates": ["Other"],
  "difficulty": "Intermediate",
  "chunk_summary": "Tóm tắt chunk này bằng tiếng Việt trong 4 đến 6 câu.",
  "important_points": ["ý chính 1", "ý chính 2", "ý chính 3", "ý chính 4", "ý chính 5"],
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8", "keyword 9", "keyword 10", "keyword 11", "keyword 12", "keyword 13", "keyword 14", "keyword 15"]
}}

Tên file:
{file_name}

Nội dung chunk:
\"\"\"
{chunk_text}
\"\"\"
"""

    return prompt


def build_final_synthesis_prompt(file_name, partial_results):
    partial_results_text = json.dumps(
        partial_results,
        ensure_ascii=False,
        indent=2
    )

    prompt = f"""
Bạn là AI tổng hợp kết quả phân tích học liệu.

Tài liệu PDF này quá dài nên đã được chia thành nhiều chunk.
Dưới đây là kết quả phân tích từng chunk.

Nhiệm vụ:
Tổng hợp các chunk lại thành kết quả cuối cùng cho toàn bộ tài liệu.

Yêu cầu:
- Chỉ trả về JSON hợp lệ.
- Không dùng markdown.
- Không giải thích ngoài JSON.
- Summary viết bằng tiếng Việt.
- Keywords xuất nhiều, khoảng 20 đến 30 keywords.
- Chọn 1 topic chính phù hợp nhất.
- Chọn 1 difficulty phù hợp nhất cho toàn bộ tài liệu.

Topic hợp lệ:
- Artificial Intelligence
- Machine Learning
- Database
- Cybersecurity
- Web Development
- Software Engineering
- Computer Networks
- Mathematics
- Data Science
- Language Learning
- Other

Difficulty hợp lệ:
- Beginner
- Intermediate
- Advanced

Trả về đúng JSON format này:
{{
  "topic": "Other",
  "difficulty": "Intermediate",
  "summary": "Tóm tắt tiếng Việt cho toàn bộ tài liệu trong 6 đến 10 câu.",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8", "keyword 9", "keyword 10", "keyword 11", "keyword 12", "keyword 13", "keyword 14", "keyword 15", "keyword 16", "keyword 17", "keyword 18", "keyword 19", "keyword 20"]
}}

Tên file:
{file_name}

Kết quả phân tích từng chunk:
{partial_results_text}
"""

    return prompt


def analyze_single_chunk(file_name, chunk_text, chunk_index, total_chunks):
    prompt = build_chunk_analysis_prompt(
        file_name=file_name,
        chunk_text=chunk_text,
        chunk_index=chunk_index,
        total_chunks=total_chunks
    )

    messages = [
        {
            "role": "system",
            "content": "You are a precise document analysis assistant. Always return valid JSON only."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]

    result = call_custom_chat(messages, max_tokens=2500)
    raw_response = extract_content_from_api_result(result)

    if not raw_response or not raw_response.strip():
        raise ValueError(f"Custom API không trả về nội dung cho chunk {chunk_index}. Raw result: {result}")

    parsed_result = parse_ai_json(raw_response)

    return {
        "chunk_index": chunk_index,
        "raw_response": raw_response,
        "parsed_result": parsed_result
    }


def analyze_small_document(file_name, text_content):
    prompt = build_single_analysis_prompt(file_name, text_content)

    messages = [
        {
            "role": "system",
            "content": "You are a precise document analysis assistant. Always return valid JSON only."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]

    result = call_custom_chat(messages, max_tokens=2500)
    raw_response = extract_content_from_api_result(result)

    if not raw_response or not raw_response.strip():
        raise ValueError(f"Custom API không trả về nội dung. Raw result: {result}")

    parsed_result = parse_ai_json(raw_response)

    return parsed_result, raw_response


def synthesize_chunk_results(file_name, partial_results):
    simplified_results = []

    for item in partial_results:
        simplified_results.append(item["parsed_result"])

    prompt = build_final_synthesis_prompt(file_name, simplified_results)

    messages = [
        {
            "role": "system",
            "content": "You are a precise document analysis assistant. Always return valid JSON only."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]

    result = call_custom_chat(messages, max_tokens=3000)
    raw_response = extract_content_from_api_result(result)

    if not raw_response or not raw_response.strip():
        raise ValueError(f"Custom API không trả về nội dung ở bước tổng hợp. Raw result: {result}")

    parsed_result = parse_ai_json(raw_response)

    return parsed_result, raw_response


def analyze_document_with_custom_api(file_name, text_content):
    chunks = split_text_into_chunks(text_content)

    if len(chunks) == 1:
        parsed_result, raw_response = analyze_small_document(
            file_name=file_name,
            text_content=chunks[0]
        )

        topic = normalize_topic(parsed_result.get("topic", "Other"))
        difficulty = normalize_difficulty(parsed_result.get("difficulty", "Intermediate"))
        summary = parsed_result.get("summary", "")
        keywords = parsed_result.get("keywords", [])

        if isinstance(keywords, list):
            keywords = ", ".join(str(keyword) for keyword in keywords)
        else:
            keywords = str(keywords)

        return {
            "topic": topic,
            "difficulty": difficulty,
            "summary": summary,
            "keywords": keywords,
            "raw_response": raw_response,
            "chunks_count": 1
        }

    partial_results = []

    for index, chunk in enumerate(chunks, start=1):
        chunk_result = analyze_single_chunk(
            file_name=file_name,
            chunk_text=chunk,
            chunk_index=index,
            total_chunks=len(chunks)
        )

        partial_results.append(chunk_result)

    final_result, final_raw_response = synthesize_chunk_results(
        file_name=file_name,
        partial_results=partial_results
    )

    topic = normalize_topic(final_result.get("topic", "Other"))
    difficulty = normalize_difficulty(final_result.get("difficulty", "Intermediate"))
    summary = final_result.get("summary", "")
    keywords = final_result.get("keywords", [])

    if isinstance(keywords, list):
        keywords = ", ".join(str(keyword) for keyword in keywords)
    else:
        keywords = str(keywords)

    debug_response = {
        "chunks_count": len(chunks),
        "partial_results": [item["parsed_result"] for item in partial_results],
        "final_raw_response": final_raw_response
    }

    return {
        "topic": topic,
        "difficulty": difficulty,
        "summary": summary,
        "keywords": keywords,
        "raw_response": json.dumps(debug_response, ensure_ascii=False, indent=2),
        "chunks_count": len(chunks)
    }


def test_custom_api_connection():
    messages = [
        {
            "role": "user",
            "content": """
Chỉ trả về JSON hợp lệ, không markdown:
{
  "status": "ok",
  "message": "Custom API is working"
}
"""
        }
    ]

    return call_custom_chat(messages, max_tokens=300)


def render_document_card(doc_id, file_name, topic, difficulty, score=None):
    topic_display = show_value(topic, "Chưa phân loại")
    difficulty_display = show_value(difficulty, "Chưa đánh giá")

    score_text = ""
    if score is not None:
        score_text = f" | score: {score}"

    with st.expander(
        f"{doc_id}. {file_name} | {topic_display} | {difficulty_display}{score_text}"
    ):
        selected_doc = get_document_by_id(doc_id)

        if selected_doc:
            (
                selected_id,
                selected_file_name,
                text_content,
                selected_topic,
                selected_difficulty,
                selected_summary,
                selected_keywords,
                selected_created_at
            ) = selected_doc

            estimated_chunks = math.ceil(
                max(len(text_content), 1) / ANALYSIS_CHUNK_CHAR_LIMIT
            )

            st.write(f"**Tên file:** {selected_file_name}")
            st.write(f"**Ngày lưu:** {selected_created_at}")
            st.write(f"**Tổng số ký tự đã lưu:** {len(text_content)}")
            st.write(f"**Số lượt gọi phân tích ước tính:** {estimated_chunks}")

            st.divider()

            st.subheader("Thông tin AI phân tích")

            col_ai_1, col_ai_2 = st.columns(2)

            with col_ai_1:
                st.write(f"**Topic:** {show_value(selected_topic, 'Chưa phân loại')}")

            with col_ai_2:
                st.write(f"**Difficulty:** {show_value(selected_difficulty, 'Chưa đánh giá')}")

            st.write("**Summary:**")
            st.info(show_value(selected_summary, "Chưa có tóm tắt"))

            st.write("**Keywords:**")
            st.code(show_value(selected_keywords, "Chưa có keywords"))

            if st.button(
                "Phân tích bằng Custom API",
                key=f"analyze_{doc_id}"
            ):
                with st.spinner(
                    f"Custom API đang phân tích tài liệu. "
                    f"Nếu file lớn, app sẽ chia thành khoảng {estimated_chunks} chunk..."
                ):
                    try:
                        ai_result = analyze_document_with_custom_api(
                            selected_file_name,
                            text_content
                        )

                        update_document_ai_result(
                            selected_id,
                            ai_result["topic"],
                            ai_result["difficulty"],
                            ai_result["summary"],
                            ai_result["keywords"]
                        )

                        st.success(
                            f"Đã phân tích và lưu kết quả AI! "
                            f"Số chunk đã xử lý: {ai_result['chunks_count']}"
                        )

                        with st.expander("Xem raw/debug response từ AI"):
                            st.code(ai_result["raw_response"])

                        st.rerun()

                    except requests.exceptions.ConnectionError:
                        st.error(
                            "Không kết nối được Custom API. "
                            "Hãy kiểm tra API base đã cấu hình và server đang chạy."
                        )

                    except requests.exceptions.Timeout:
                        st.error(
                            "API xử lý quá lâu và bị timeout. "
                            "Có thể tài liệu quá dài hoặc server model đang bận."
                        )

                    except Exception as error:
                        st.error(f"Lỗi khi phân tích bằng Custom API: {error}")

            st.divider()

            st.subheader("Preview nội dung")
            st.caption(
                f"Đang hiển thị {min(len(text_content), PREVIEW_LIMIT)} "
                f"/ {len(text_content)} ký tự đầu tiên"
            )

            st.text_area(
                "Preview nội dung",
                text_content[:PREVIEW_LIMIT],
                height=300,
                key=f"text_{doc_id}"
            )

            col1, col2 = st.columns([1, 1])

            with col1:
                st.download_button(
                    label="Tải full text",
                    data=text_content,
                    file_name=f"{selected_file_name}.txt",
                    mime="text/plain",
                    key=f"download_{doc_id}"
                )

            with col2:
                confirm_delete = st.checkbox(
                    "Xác nhận xóa tài liệu này",
                    key=f"confirm_delete_{doc_id}"
                )

                if st.button(
                    "Xóa tài liệu",
                    key=f"delete_{doc_id}"
                ):
                    if confirm_delete:
                        delete_document(doc_id)
                        st.success(f"Đã xóa tài liệu: {selected_file_name}")
                        st.rerun()
                    else:
                        st.warning("Bạn cần tick xác nhận trước khi xóa.")


st.set_page_config(
    page_title="Smart Learning Resources MVP",
    page_icon="📚",
    layout="wide"
)

init_db()
upgrade_db()

st.title("📚 Smart Learning Resources Management - MVP")

with st.sidebar:
    st.subheader("Cấu hình AI API")
    st.write(f"**API base:** `{API_BASE_URL}`")
    st.write(f"**Model:** `{API_MODEL}`")
    st.write(f"**Chunk size:** `{ANALYSIS_CHUNK_CHAR_LIMIT}` ký tự/chunk")
    st.write(f"**Chunk overlap:** `{ANALYSIS_CHUNK_OVERLAP}` ký tự")

    if st.button("Test Custom API"):
        try:
            test_result = test_custom_api_connection()
            content = extract_content_from_api_result(test_result)

            st.success("Kết nối Custom API thành công!")

            st.write("Response content:")
            st.code(content)

            with st.expander("Raw API response"):
                st.code(json.dumps(test_result, ensure_ascii=False, indent=2))

        except Exception as error:
            st.error(f"Test Custom API lỗi: {error}")


tab1, tab2 = st.tabs(["Upload PDF", "Tìm kiếm & quản lý tài liệu"])


with tab1:
    st.subheader("Upload và lưu PDF")

    uploaded_file = st.file_uploader(
        "Upload một file PDF",
        type=["pdf"]
    )

    if uploaded_file is not None:
        st.success(f"Đã upload file: {uploaded_file.name}")

        if st.button("Đọc và lưu PDF"):
            with st.spinner("Đang đọc PDF..."):
                extracted_text, total_pages = extract_text_from_pdf(uploaded_file)

            if extracted_text.strip():
                save_document(uploaded_file.name, extracted_text)

                st.success("Đã lưu full text của tài liệu vào database!")

                st.info(f"PDF có tổng cộng: {total_pages} trang")
                st.info(f"Tổng số ký tự trích xuất được: {len(extracted_text)}")

                st.subheader("Preview nội dung")
                st.caption(
                    f"Đang hiển thị {min(len(extracted_text), PREVIEW_LIMIT)} "
                    f"/ {len(extracted_text)} ký tự đầu tiên"
                )

                st.text_area(
                    "Preview text trích xuất được",
                    extracted_text[:PREVIEW_LIMIT],
                    height=400
                )

                st.download_button(
                    label="Tải full text dạng .txt",
                    data=extracted_text,
                    file_name=f"{uploaded_file.name}.txt",
                    mime="text/plain"
                )

            else:
                st.warning(
                    "Không đọc được text từ file PDF này. "
                    "Có thể đây là PDF scan ảnh hoặc file không có text layer."
                )


with tab2:
    st.subheader("Tìm kiếm & quản lý tài liệu")

    total_documents = get_document_count()
    st.info(f"Tổng số tài liệu đang lưu trong database: {total_documents}")

    st.divider()

    col_search_1, col_search_2, col_search_3 = st.columns([2, 1, 1])

    with col_search_1:
        search_query = st.text_input(
            "Tìm kiếm",
            placeholder="Ví dụ: sql, mach learn, ai, database, neural, bảo mật..."
        )

    with col_search_2:
        topic_filter = st.selectbox(
            "Lọc theo topic",
            TOPIC_OPTIONS
        )

    with col_search_3:
        difficulty_filter = st.selectbox(
            "Lọc theo difficulty",
            DIFFICULTY_OPTIONS
        )

    filtered_documents = search_documents(
        search_query=search_query,
        topic_filter=topic_filter,
        difficulty_filter=difficulty_filter
    )

    st.write(f"**Số kết quả tìm thấy:** {len(filtered_documents)}")

    if search_query.strip():
        st.caption(
            "Search hiện tại đã hỗ trợ tách từ, bỏ dấu tiếng Việt, match gần đúng ở metadata, "
            "và có mở rộng một số từ viết tắt như AI, ML, DB, SQL, NLP."
        )

    if filtered_documents:
        for doc in filtered_documents:
            render_document_card(
                doc_id=doc["id"],
                file_name=doc["file_name"],
                topic=doc["topic"],
                difficulty=doc["difficulty"],
                score=doc["score"] if search_query.strip() else None
            )
    else:
        st.warning("Không tìm thấy tài liệu phù hợp.")
