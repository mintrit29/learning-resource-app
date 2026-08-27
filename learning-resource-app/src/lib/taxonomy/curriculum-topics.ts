import { db } from "@/lib/db";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";

export type CurriculumTopic = {
  code: string;
  semester: number;
  name: string;
  description: string;
};

export const NTTU_IT_CURRICULUM_TOPICS: CurriculumTopic[] = [
  { code: "1001074619", semester: 2, name: "Toán cao cấp (CNTT)", description: "Toán nền tảng cho công nghệ thông tin, đại số, giải tích và ứng dụng tính toán." },
  { code: "1001074705", semester: 2, name: "Lập trình", description: "Nhập môn lập trình, tư duy thuật toán, biến, điều kiện, vòng lặp và hàm." },
  { code: "1001074710", semester: 2, name: "Đề án nghiên cứu (CNTT)", description: "Phương pháp nghiên cứu, xây dựng đề cương và thực hiện đề án trong lĩnh vực CNTT." },
  { code: "1001074650", semester: 3, name: "Toán rời rạc", description: "Logic, tập hợp, quan hệ, đồ thị, tổ hợp và nền tảng toán học cho khoa học máy tính." },
  { code: "1001074648", semester: 4, name: "Thiết kế và phát triển cơ sở dữ liệu", description: "Mô hình dữ liệu, SQL, chuẩn hóa, thiết kế và triển khai cơ sở dữ liệu." },
  { code: "1001074620", semester: 5, name: "Lập trình nâng cao", description: "Kỹ thuật lập trình nâng cao, hướng đối tượng, tổ chức và tối ưu mã nguồn." },
  { code: "1001074716", semester: 5, name: "Bảo mật", description: "An toàn thông tin, bảo mật hệ thống, mật mã, lỗ hổng và phòng chống tấn công." },
  { code: "1001076269", semester: 5, name: "Cấu trúc dữ liệu và giải thuật", description: "Cấu trúc dữ liệu, thuật toán, phân tích độ phức tạp, tìm kiếm và sắp xếp." },
  { code: "1001074724", semester: 6, name: "Thiết kế và phát triển ứng dụng Web", description: "Thiết kế web, frontend, backend, HTTP, API và triển khai ứng dụng web." },
  { code: "1001076270", semester: 6, name: "Công nghệ phần mềm", description: "Quy trình, yêu cầu, thiết kế, xây dựng và bảo trì phần mềm." },
  { code: "1001074629", semester: 7, name: "Hệ thống thông tin doanh nghiệp (CNTT)", description: "Hệ thống thông tin, quy trình và giải pháp công nghệ trong doanh nghiệp." },
  { code: "1001074635", semester: 7, name: "Hệ điều hành", description: "Tiến trình, bộ nhớ, hệ thống tệp, đồng bộ và quản lý tài nguyên máy tính." },
  { code: "1001076271", semester: 7, name: "Quản lý dự án (CNTT)", description: "Lập kế hoạch, nhân lực, chi phí, rủi ro và theo dõi dự án công nghệ thông tin." },
  { code: "1001074622", semester: 8, name: "Lập trình giao diện ứng dụng", description: "Thiết kế trải nghiệm và lập trình giao diện người dùng cho ứng dụng." },
  { code: "1001074630", semester: 8, name: "Kinh doanh thông minh (CNTT)", description: "Kho dữ liệu, phân tích dữ liệu, báo cáo và hỗ trợ quyết định kinh doanh." },
  { code: "1001074700", semester: 8, name: "Hệ thống mạng", description: "Mạng máy tính, giao thức, mô hình mạng, thiết bị và quản trị kết nối." },
  { code: "1001074706", semester: 8, name: "Lập trình thiết bị di động", description: "Thiết kế và phát triển ứng dụng trên nền tảng thiết bị di động." },
  { code: "1001076272", semester: 8, name: "Kiểm thử phần mềm", description: "Kỹ thuật kiểm thử, thiết kế test case, tự động hóa và bảo đảm chất lượng phần mềm." },
  { code: "1001074621", semester: 9, name: "Phát triển ứng dụng", description: "Phân tích, thiết kế, xây dựng và hoàn thiện một ứng dụng phần mềm." },
  { code: "1001074636", semester: 9, name: "Công nghệ đám mây", description: "Điện toán đám mây, dịch vụ cloud, ảo hóa, container và triển khai hệ thống." },
  { code: "1001076273", semester: 9, name: "Kiến trúc phần mềm", description: "Mẫu kiến trúc, thành phần, tích hợp và các thuộc tính chất lượng của phần mềm." },
  { code: "1001076274", semester: 9, name: "Mô hình phát triển phần mềm Agile", description: "Agile, Scrum, phát triển lặp, quản lý backlog và phối hợp nhóm phần mềm." },
  { code: "1001074649", semester: 10, name: "Quản lý hệ thống dữ liệu (CNTT)", description: "Quản trị, vận hành, tích hợp, sao lưu và bảo đảm chất lượng hệ thống dữ liệu." },
  { code: "1001074651", semester: 10, name: "Chiến lược thương mại điện tử", description: "Mô hình, nền tảng, vận hành và chiến lược phát triển hệ thống thương mại điện tử." },
  { code: "1001076275", semester: 10, name: "Hệ thống nhúng thông minh và IoT", description: "Hệ thống nhúng, cảm biến, vi điều khiển, kết nối và Internet vạn vật." },
  { code: "1001077344", semester: 11, name: "Thực tập tốt nghiệp", description: "Tài liệu, báo cáo và sản phẩm thực tập nghề nghiệp trong lĩnh vực CNTT." },
  { code: "1001077345", semester: 12, name: "Đồ án tốt nghiệp", description: "Tài liệu, báo cáo, thiết kế và sản phẩm đồ án tốt nghiệp ngành CNTT." },
];

function topicDescription(topic: CurriculumTopic) {
  return `NTTU · Học kỳ ${topic.semester} · Mã ${topic.code}. ${topic.description}`;
}

const globalForCurriculum = globalThis as typeof globalThis & {
  scholarFlowCurriculumInitialization?: Promise<void>;
};

async function initializeCurriculumTopics() {
  await db.$transaction(async (transaction) => {
    for (const topic of NTTU_IT_CURRICULUM_TOPICS) {
      const normalizedName = normalizeTagName(topic.name);
      const existing = await transaction.tag.findFirst({ where: { normalizedName } });
      if (existing) {
        await transaction.tag.update({
          where: { id: existing.id },
          data: { isClassificationEnabled: true },
        });
      } else {
        await transaction.tag.create({
          data: {
          name: topic.name,
          normalizedName,
          description: topicDescription(topic),
          isClassificationEnabled: true,
          },
        });
      }
    }

    const allowedTopics = await transaction.tag.findMany({
      where: { isClassificationEnabled: true },
      select: { id: true, name: true },
    });
    const allowedTopicIds = allowedTopics.map((topic) => topic.id);
    const allowedTopicNames = allowedTopics.map((topic) => topic.name);
    const legacyDocuments = await transaction.document.findMany({
      where: {
        primaryTopic: { notIn: allowedTopicNames },
      },
      select: { id: true },
    });
    const legacyDocumentIds = legacyDocuments.map((document) => document.id);

    await transaction.document.updateMany({
      where: { id: { in: legacyDocumentIds } },
      data: {
        primaryTopic: null,
        analysisReason: "Chủ đề từ phiên bản cũ chưa được người dùng xác nhận. Tài liệu đang chờ phân loại lại.",
      },
    });
    await transaction.documentTag.deleteMany({
      where: {
        OR: [
          { tagId: { notIn: allowedTopicIds } },
          ...(legacyDocumentIds.length ? [{ documentId: { in: legacyDocumentIds } }] : []),
        ],
      },
    });
  });
}

export function ensureCurriculumTopics() {
  if (!globalForCurriculum.scholarFlowCurriculumInitialization) {
    globalForCurriculum.scholarFlowCurriculumInitialization = initializeCurriculumTopics().catch((error) => {
      globalForCurriculum.scholarFlowCurriculumInitialization = undefined;
      throw error;
    });
  }

  return globalForCurriculum.scholarFlowCurriculumInitialization;
}
