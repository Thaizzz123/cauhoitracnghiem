/**
 * parser.js
 * ------------------------------------------------------------------
 * Bộ phân tích & chuẩn hóa đề trắc nghiệm từ văn bản thô (có thể rất lộn xộn)
 * thành cấu trúc dữ liệu thống nhất.
 *
 * ĐỊNH DẠNG ĐẦU VÀO MONG ĐỢI (nhưng dung sai lớn với lỗi trình bày):
 *   Câu 1: Nội dung câu hỏi...
 *   A. Phương án 1
 *   *B. Phương án 2   <-- dấu * đứng trước chữ cái = đáp án đúng
 *   C. Phương án 3
 *   D. Phương án 4
 *
 * NGUYÊN TẮC THIẾT KẾ:
 *  - Không dựa vào số thứ tự "Câu N" gốc (có thể sai/trùng/thiếu) để đánh số.
 *    Hệ thống tự đánh số lại tuần tự theo thứ tự xuất hiện.
 *  - Không dựa vào việc xuống dòng để tách nội dung. Mọi khoảng trắng
 *    (space, tab, newline liên tiếp) đều được coi là tương đương và gộp lại,
 *    nhờ vậy các lỗi: khoảng trắng sai, xuống dòng sai, dòng trắng thừa,
 *    khoảng cách không đều, câu viết liền (không xuống dòng) đều được xử lý.
 *  - Mốc phân tách duy nhất được tin tưởng là các nhãn: "Câu <số>" và
 *    "A." "B." "C." "D." (cho phép dấu . ) hoặc : ngay sau chữ cái).
 *  - Nếu một câu không đủ 4 mốc A/B/C/D, hoặc không có đúng 1 dấu *,
 *    câu đó sẽ bị BÁO LỖI RÕ RÀNG chứ không tự đoán bừa đáp án đúng.
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  // Mốc nhận diện đầu 1 câu hỏi: "Câu" + số + dấu . : - (tuỳ chọn)
  // Cho phép: "Câu 1:", "Câu1.", "câu 12 -", "CÂU 3:"
  const QUESTION_MARK_REGEX = /C[aâ]u\s*\d+\s*[:.\-]?\s*/gi;

  // Mốc nhận diện 1 đáp án: dấu * (tuỳ chọn, đánh dấu đáp án đúng) + chữ cái A-D + . hoặc : hoặc )
  function optionMarkRegex(letter) {
    return new RegExp('(\\*)?\\s*' + letter + '\\s*[.):]\\s*', 'i');
  }

  /**
   * Gộp mọi chuỗi khoảng trắng (space/tab/newline liên tiếp) thành 1 space,
   * đồng thời trim 2 đầu. Giải quyết: khoảng trắng sai, xuống dòng sai,
   * nhiều dòng trắng, khoảng cách không đều.
   */
  function normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Bóc tách 1 khối văn bản (nội dung sau nhãn "Câu N") thành:
   * { content, options: [text,text,text,text], correctIndex, error }
   */
  function parseQuestionBlock(block) {
    // Tìm lần lượt vị trí các mốc A, B, C, D theo đúng thứ tự xuất hiện.
    const letters = ['A', 'B', 'C', 'D'];
    const positions = []; // { letter, index, matchLength, hasStar }

    let searchStart = 0;
    for (const letter of letters) {
      const regex = optionMarkRegex(letter);
      const remaining = block.slice(searchStart);
      const match = remaining.match(regex);

      if (!match) {
        return {
          error: `Thiếu đáp án "${letter}." (không tìm thấy mốc "${letter}." trong câu này).`
        };
      }

      const matchIndexInRemaining = remaining.indexOf(match[0]);
      const absoluteIndex = searchStart + matchIndexInRemaining;

      positions.push({
        letter,
        start: absoluteIndex,
        end: absoluteIndex + match[0].length,
        hasStar: !!match[1]
      });

      searchStart = absoluteIndex + match[0].length;
    }

    // Nội dung câu hỏi = phần văn bản trước mốc A.
    const questionText = normalizeWhitespace(block.slice(0, positions[0].start));

    if (!questionText) {
      return { error: 'Nội dung câu hỏi bị trống (không có chữ nào trước đáp án A).' };
    }

    // Nội dung từng đáp án = phần văn bản giữa mốc hiện tại và mốc kế tiếp
    // (riêng D lấy đến hết block).
    const options = [];
    let starCount = 0;
    let correctIndex = -1;

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].end;
      const end = i < positions.length - 1 ? positions[i + 1].start : block.length;
      const rawOptionText = block.slice(start, end);
      const optionText = normalizeWhitespace(rawOptionText);

      if (!optionText) {
        return { error: `Đáp án "${positions[i].letter}." bị trống nội dung.` };
      }

      if (positions[i].hasStar) {
        starCount++;
        correctIndex = i;
      }

      options.push(optionText);
    }

    if (starCount === 0) {
      return {
        error: 'Không tìm thấy dấu "*" đánh dấu đáp án đúng (ví dụ: *A. Hà Nội). Vui lòng kiểm tra lại đề.'
      };
    }

    if (starCount > 1) {
      return {
        error: `Có ${starCount} đáp án cùng được đánh dấu "*" (chỉ được đánh dấu đúng 1 đáp án).`
      };
    }

    return {
      content: questionText,
      options,
      correctIndex
    };
  }

  /**
   * Hàm chính: nhận văn bản thô, trả về:
   * {
   *   questions: [{ id, number, content, options: [string x4], correctIndex }],
   *   errors: [{ number, snippet, reason }]  // number = số thứ tự phát hiện được (thứ tự xuất hiện)
   * }
   */
  function parseQuizText(rawText) {
    const result = { questions: [], errors: [] };

    if (!rawText || !rawText.trim()) {
      result.errors.push({
        number: null,
        snippet: '',
        reason: 'Nội dung dán vào đang trống.'
      });
      return result;
    }

    // Tìm tất cả vị trí bắt đầu của mỗi câu hỏi dựa trên nhãn "Câu N".
    const markMatches = [...rawText.matchAll(QUESTION_MARK_REGEX)];

    if (markMatches.length === 0) {
      result.errors.push({
        number: null,
        snippet: rawText.slice(0, 80),
        reason: 'Không tìm thấy nhãn "Câu <số>:" nào trong văn bản. Kiểm tra lại định dạng đề.'
      });
      return result;
    }

    // Cắt văn bản thành từng khối, mỗi khối bắt đầu ngay SAU nhãn "Câu N"
    // và kết thúc ngay TRƯỚC nhãn "Câu N" tiếp theo (hoặc hết văn bản).
    for (let i = 0; i < markMatches.length; i++) {
      const blockStart = markMatches[i].index + markMatches[i][0].length;
      const blockEnd = i < markMatches.length - 1 ? markMatches[i + 1].index : rawText.length;
      const block = rawText.slice(blockStart, blockEnd);

      const displayNumber = i + 1; // Tự đánh số lại, không tin số gốc trong đề
      const parsed = parseQuestionBlock(block);

      if (parsed.error) {
        result.errors.push({
          number: displayNumber,
          snippet: normalizeWhitespace(block).slice(0, 100),
          reason: parsed.error
        });
        continue;
      }

      result.questions.push({
        id: 'q_' + displayNumber + '_' + Date.now(),
        number: displayNumber,
        content: parsed.content,
        options: parsed.options,
        correctIndex: parsed.correctIndex
      });
    }

    return result;
  }

  // Export cho cả trình duyệt (global) lẫn Node.js (dùng để test)
  const api = { parseQuizText };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.QuizParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
