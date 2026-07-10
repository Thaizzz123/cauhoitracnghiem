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
 *  - Số hiển thị cuối cùng LUÔN được hệ thống tự đánh lại tuần tự 1..N theo
 *    THỨ TỰ CUỐI CÙNG đã được sắp xếp (không bao giờ giữ nguyên số gốc để
 *    tránh nhảy cóc/trùng/thiếu). Số gốc "Câu N" chỉ được dùng làm CĂN CỨ
 *    SẮP XẾP khi có nhóm câu bị lẫn số khác nhóm còn lại (xem quy tắc sắp
 *    xếp bên dưới), KHÔNG phải để giữ làm số hiển thị.
 *  - Quy tắc sắp xếp khi trong đề vừa có câu ĐÁNH SỐ ("Câu 5") vừa có câu
 *    KHÔNG SỐ ("Câu"/"Câu:"):
 *      1. Đếm số lượng câu có số (nhóm SỐ) và không số (nhóm TRỐNG).
 *      2. Nhóm nào ÍT hơn bị xem là các trường hợp lạc loài, bị đẩy XUỐNG
 *         CUỐI bảng; nhóm nhiều hơn đứng trước làm "khung chính".
 *      3. Trong nhóm SỐ: sắp xếp theo số gốc tăng dần.
 *         Trong nhóm TRỐNG: giữ nguyên thứ tự xuất hiện trong văn bản gốc.
 *      4. Nếu hai nhóm bằng số lượng nhau (50/50): nhóm SỐ luôn đứng trước.
 *      5. Cuối cùng đánh số lại toàn bộ 1..N theo thứ tự đã sắp ở trên.
 *  - Không dựa vào việc xuống dòng để tách nội dung. Mọi khoảng trắng
 *    (space, tab, newline liên tiếp) đều được coi là tương đương và gộp lại,
 *    nhờ vậy các lỗi: khoảng trắng sai, xuống dòng sai, dòng trắng thừa,
 *    khoảng cách không đều, câu viết liền (không xuống dòng) đều được xử lý.
 *  - Mốc phân tách duy nhất được tin tưởng là các nhãn: "Câu <số>" và
 *    "A." "B." "C." "D." (cho phép dấu . ) hoặc : ngay sau chữ cái).
 *  - Nếu một câu không đủ 4 mốc A/B/C/D, hoặc không có đúng 1 dấu *,
 *    câu đó sẽ bị BÁO LỖI RÕ RÀNG chứ không tự đoán bừa đáp án đúng.
 *  - TỰ ĐỘNG LỌC NHIỄU tiêu đề/mô tả/lời cảm ơn... (thường gặp khi copy
 *    nguyên cả file đề thi, có dòng giới thiệu ở đầu hoặc ghi chú ở cuối):
 *      + Nếu 1 khối bị lỗi mà KHÔNG tìm thấy cả mốc "A." nào — tức chắc
 *        chắn không phải câu hỏi thật (câu hỏi thật luôn có đáp án A) —
 *        hệ thống tự bỏ qua, không báo lỗi giả cho người dùng.
 *      + Nếu nội dung 1 đáp án có dòng trống ở giữa (ngắt đoạn), chỉ lấy
 *        đoạn văn bản đầu tiên làm nội dung thật; phần sau dòng trống
 *        (thường là ghi chú/lời cảm ơn dán liền cuối đáp án D của câu
 *        cuối cùng, do không có mốc "Câu" mới để tách riêng) bị cắt bỏ.
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  // Mốc nhận diện đầu 1 câu hỏi: chữ "Câu"/"Cau" (không phân biệt hoa/thường,
  // có/không dấu) + SỐ (tuỳ chọn, có thể thiếu, được BẮT làm group để dùng
  // cho việc sắp xếp) + dấu phân cách (tuỳ chọn).
  // Cho phép mọi biến thể: "Câu 1:", "Câu1.", "câu 12 -", "CÂU 3:", "cÂu:",
  // "Câu :", "Cau", "Câu — 4)", v.v.
  // Điều kiện bắt buộc: phải có ÍT NHẤT MỘT trong hai thứ đi sau chữ "câu"
  // (cách nhau bởi khoảng trắng tuỳ ý) là SỐ hoặc DẤU PHÂN CÁCH — để tránh
  // nhận nhầm chữ "câu" xuất hiện tự nhiên trong nội dung văn bản (vd: "trả
  // lời câu hỏi này").
  //   - Nhánh 1: có số (group 1 = chuỗi số), tuỳ chọn dấu phân cách theo sau
  //   - Nhánh 2: không có số, nhưng bắt buộc có dấu phân cách
  const QUESTION_MARK_REGEX = /C[aâ]u\s*(?:(\d+)\s*[:.\-–—)]?|[:.\-–—)])\s*/gi;

  // Mốc nhận diện 1 đáp án: dấu * (tuỳ chọn, đánh dấu đáp án đúng) + chữ cái A-D
  // + dấu phân cách (bắt buộc phải có 1 trong các dấu sau, để tránh nhận nhầm
  // chữ cái A/B/C/D xuất hiện tự nhiên trong nội dung câu hỏi/đáp án):
  // . : ) - – —
  function optionMarkRegex(letter) {
    return new RegExp('(\\*)?\\s*' + letter + '\\s*[.:\\-–—)]\\s*', 'i');
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
          error: `Thiếu đáp án "${letter}." (không tìm thấy mốc "${letter}." trong câu này).`,
          // Nếu ngay cả mốc "A." cũng không tìm thấy trong TOÀN BỘ block, gần
          // như chắc chắn đây không phải 1 câu hỏi thật bị lỗi định dạng, mà
          // chỉ là văn bản linh tinh lọt vào (tiêu đề, mô tả, ghi chú...) vô
          // tình chứa chữ "Câu <số>" trùng với nhãn nhận diện. Một câu hỏi
          // được gõ thật, dù sai định dạng B/C/D, hầu như luôn còn đáp án A.
          likelyNoise: letter === 'A'
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

      // Nếu nội dung đáp án có DÒNG TRỐNG (ngắt đoạn) ở giữa, chỉ lấy đoạn
      // văn bản ĐẦU TIÊN trước dòng trống đó làm nội dung thật; phần phía
      // sau bị cắt bỏ. Trường hợp hay gặp nhất: đáp án D của CÂU CUỐI CÙNG
      // trong file/nguồn — sau khi hết nội dung câu trả lời thật, nếu file
      // còn dòng tiêu đề phần tiếp theo, lời cảm ơn, ghi chú nguồn... dán
      // liền phía dưới (không có mốc "Câu" mới để tách ra thành block riêng)
      // thì đoạn đó sẽ vô tình bị gộp vào nội dung đáp án D nếu không cắt.
      const firstParagraph = rawOptionText.split(/\n\s*\n/)[0];
      const optionText = normalizeWhitespace(firstParagraph);

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

    // Tìm tất cả vị trí bắt đầu của mỗi câu hỏi dựa trên nhãn "Câu N" (hoặc "Câu").
    const markMatches = [...rawText.matchAll(QUESTION_MARK_REGEX)];

    if (markMatches.length === 0) {
      result.errors.push({
        number: null,
        snippet: rawText.slice(0, 80),
        reason: 'Không tìm thấy nhãn "Câu <số>:" nào trong văn bản. Kiểm tra lại định dạng đề.'
      });
      return result;
    }

    // BƯỚC 1: Cắt văn bản thành từng khối theo thứ tự xuất hiện gốc, đồng thời
    // ghi nhận số gốc (nếu có) đọc được từ chính nhãn "Câu N" của khối đó.
    // Câu lỗi (thiếu A/B/C/D, thiếu/thừa dấu *...) được báo ngay tại đây,
    // không tham gia vào bước sắp xếp/đánh số bên dưới.
    const parsedBlocks = []; // { appearanceIndex, originalNumber (number|null), parsed }

    for (let i = 0; i < markMatches.length; i++) {
      const blockStart = markMatches[i].index + markMatches[i][0].length;
      const blockEnd = i < markMatches.length - 1 ? markMatches[i + 1].index : rawText.length;
      const block = rawText.slice(blockStart, blockEnd);
      const originalNumber = markMatches[i][1] ? parseInt(markMatches[i][1], 10) : null;

      const parsed = parseQuestionBlock(block);

      if (parsed.error) {
        // Bỏ qua ÂM THẦM (không báo lỗi) nếu:
        //  a) parseQuestionBlock xác định đây gần như chắc chắn không phải
        //     câu hỏi thật (likelyNoise — không có cả mốc "A."), HOẶC
        //  b) block quá ngắn một cách bất thường (lưới an toàn phụ, phòng
        //     trường hợp lạ chưa lường hết).
        // Đây là các trường hợp: tiêu đề đầu file, mô tả, lời cảm ơn/ghi chú
        // cuối file... vô tình chứa chữ "Câu <số>" trùng nhãn nhận diện,
        // KHÔNG phải lỗi định dạng thật của người dùng cần cảnh báo.
        const MIN_MEANINGFUL_BLOCK_LENGTH = 20;
        const normalizedBlock = normalizeWhitespace(block).trim();
        if (parsed.likelyNoise || normalizedBlock.length < MIN_MEANINGFUL_BLOCK_LENGTH) {
          continue;
        }

        result.errors.push({
          number: i + 1, // vị trí xuất hiện thứ mấy trong văn bản gốc (chỉ để định vị lỗi)
          snippet: normalizedBlock.slice(0, 100),
          reason: parsed.error
        });
        continue;
      }

      parsedBlocks.push({
        appearanceIndex: i,
        originalNumber,
        parsed
      });
    }

    // BƯỚC 2: Áp dụng quy tắc sắp xếp:
    //  - Nhóm CÓ SỐ: các câu đọc được số gốc từ nhãn "Câu N".
    //  - Nhóm KHÔNG SỐ: các câu chỉ có nhãn "Câu" trơn (không số).
    //  - Nhóm nào ÍT hơn bị đẩy xuống cuối; bằng nhau thì nhóm CÓ SỐ lên đầu.
    //  - Trong nhóm CÓ SỐ: sắp theo số gốc tăng dần (ổn định nếu trùng số).
    //  - Trong nhóm KHÔNG SỐ: giữ nguyên thứ tự xuất hiện gốc.
    const numberedGroup = parsedBlocks
      .filter((b) => b.originalNumber !== null)
      .sort((a, b) => a.originalNumber - b.originalNumber || a.appearanceIndex - b.appearanceIndex);

    const unnumberedGroup = parsedBlocks
      .filter((b) => b.originalNumber === null)
      .sort((a, b) => a.appearanceIndex - b.appearanceIndex);

    let finalOrder;
    if (unnumberedGroup.length > numberedGroup.length) {
      // Đa số không đánh số -> khung chính là nhóm không số, nhóm có số
      // (thiểu số, "lạc loài") bị đẩy xuống cuối, sắp theo số tăng dần.
      finalOrder = unnumberedGroup.concat(numberedGroup);
    } else {
      // Đa số có đánh số, hoặc hai nhóm bằng nhau (50/50) -> nhóm có số lên
      // đầu (sắp theo số tăng dần), nhóm không số (thiểu số/còn lại) xuống
      // cuối theo đúng thứ tự xuất hiện gốc.
      finalOrder = numberedGroup.concat(unnumberedGroup);
    }

    // BƯỚC 3: Đánh số lại tuần tự 1..N theo thứ tự cuối cùng đã sắp xếp,
    // xoá hoàn toàn số gốc để tránh nhảy cóc/trùng số.
    finalOrder.forEach((b, idx) => {
      const displayNumber = idx + 1;
      result.questions.push({
        id: 'q_' + displayNumber + '_' + Date.now() + '_' + b.appearanceIndex,
        number: displayNumber,
        content: b.parsed.content,
        options: b.parsed.options,
        correctIndex: b.parsed.correctIndex
      });
    });

    return result;
  }

  /**
   * Gộp nhiều NGUỒN văn bản (vd: nội dung textarea + nhiều file upload) thành
   * 1 bộ câu hỏi duy nhất, theo nguyên tắc:
   *  - Mỗi nguồn được parse ĐỘC LẬP bằng parseQuizText (áp dụng đầy đủ quy tắc
   *    sắp xếp/đánh số nội bộ riêng cho nguồn đó — không trộn lẫn số giữa
   *    các nguồn khi quyết định thứ tự).
   *  - Nguồn nào đứng TRƯỚC trong mảng `sources` thì câu hỏi của nó được đánh
   *    số TRƯỚC. Nguồn tiếp theo được đánh số tiếp nối ngay sau số cuối cùng
   *    của nguồn trước đó (vd nguồn 1 có 10 câu -> 1-10, nguồn 2 tiếp -> 11-20).
   *  - Lỗi của từng nguồn được giữ nguyên, kèm nhãn `source` để biết lỗi
   *    thuộc file/nguồn nào.
   *
   * @param {Array<{label: string, text: string}>} sources
   * @returns {{questions: Array, errors: Array}}
   */
  function parseMultipleQuizTexts(sources) {
    const combined = { questions: [], errors: [] };
    let offset = 0;

    (sources || []).forEach((source) => {
      const label = source.label || '';
      const text = source.text || '';

      if (!text.trim()) {
        return; // Bỏ qua nguồn trống (vd chưa nhập gì vào textarea)
      }

      const r = parseQuizText(text);

      r.errors.forEach((e) => {
        combined.errors.push(Object.assign({}, e, { source: label }));
      });

      r.questions.forEach((q) => {
        const newNumber = offset + q.number;
        combined.questions.push(Object.assign({}, q, {
          number: newNumber,
          id: 'q_' + newNumber + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          source: label
        }));
      });

      offset += r.questions.length;
    });

    return combined;
  }

  // Export cho cả trình duyệt (global) lẫn Node.js (dùng để test)
  const api = { parseQuizText, parseMultipleQuizTexts };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.QuizParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
