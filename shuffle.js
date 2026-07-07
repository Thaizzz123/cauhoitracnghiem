/**
 * shuffle.js
 * ------------------------------------------------------------------
 * Engine đảo thứ tự câu hỏi + đảo vị trí đáp án (A/B/C/D) cho mỗi lượt làm bài,
 * đảm bảo tuyệt đối KHÔNG làm sai lệch đáp án đúng sau khi đảo.
 *
 * NGUYÊN TẮC:
 *  - KHÔNG đảo trực tiếp trên `questionBank` gốc (dữ liệu đã import từ parser).
 *    Mỗi lượt làm bài sẽ tạo ra một "phiên làm bài" (session) mới, độc lập,
 *    chỉ chứa dữ liệu đã đảo — dữ liệu gốc luôn được giữ nguyên để có thể
 *    tạo phiên mới khác đi ở lần làm tiếp theo.
 *  - Dùng thuật toán Fisher–Yates để đảo mảng, KHÔNG dùng `array.sort(() =>
 *    Math.random() - 0.5)`. Lý do: sort-based shuffle có thiên lệch phân phối
 *    (một số hoán vị có xác suất xuất hiện cao hơn hẳn các hoán vị khác,
 *    tùy thuật toán sort nội bộ của mỗi trình duyệt), trong khi Fisher–Yates
 *    cho xác suất đồng đều thực sự giữa mọi hoán vị.
 *  - Vị trí đáp án đúng được TRACK bằng cách gắn cờ `isCorrect` vào từng đáp án
 *    TRƯỚC khi đảo, sau đó tìm lại vị trí mới bằng cách dò cờ này — không bao
 *    giờ suy luận đáp án đúng dựa trên vị trí cố định.
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  /**
   * Đảo ngẫu nhiên 1 mảng bằng thuật toán Fisher–Yates.
   * Không thay đổi mảng gốc — trả về mảng mới.
   */
  function shuffleArray(sourceArray) {
    const arr = sourceArray.slice(); // copy, không mutate gốc
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Đảo vị trí 4 đáp án của MỘT câu hỏi, trả về câu hỏi "phiên bản phiên làm bài":
   * { id, number, content, options: [text x4], correctIndex }
   * trong đó options đã đảo và correctIndex là vị trí MỚI của đáp án đúng.
   */
  function shuffleQuestionOptions(question) {
    // Gắn cờ isCorrect vào từng đáp án dựa trên correctIndex gốc,
    // để sau khi đảo vẫn biết đáp án nào là đúng.
    const taggedOptions = question.options.map((text, idx) => ({
      text,
      isCorrect: idx === question.correctIndex
    }));

    const shuffledOptions = shuffleArray(taggedOptions);
    const newCorrectIndex = shuffledOptions.findIndex(opt => opt.isCorrect);

    return {
      id: question.id,
      number: question.number,
      content: question.content,
      options: shuffledOptions.map(opt => opt.text),
      correctIndex: newCorrectIndex
    };
  }

  /**
   * Tạo một "phiên làm bài" mới từ danh sách câu hỏi gốc:
   *  - Đảo thứ tự các câu hỏi.
   *  - Đảo vị trí đáp án của từng câu hỏi.
   * Trả về mảng câu hỏi đã sẵn sàng để hiển thị, KHÔNG đụng vào dữ liệu gốc.
   *
   * @param {Array} questions - danh sách câu hỏi gốc (từ questionBank hoặc danh sách câu đã sai)
   * @returns {Array} danh sách câu hỏi đã đảo, sẵn sàng cho 1 lượt làm bài
   */
  function buildSession(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return [];

    const shuffledQuestionOrder = shuffleArray(questions);
    return shuffledQuestionOrder.map(shuffleQuestionOptions);
  }

  /**
   * Kiểm tra đáp án được chọn (chỉ số 0-3) có đúng với câu hỏi trong phiên làm bài không.
   */
  function isAnswerCorrect(sessionQuestion, selectedIndex) {
    return selectedIndex === sessionQuestion.correctIndex;
  }

  const api = { shuffleArray, shuffleQuestionOptions, buildSession, isAnswerCorrect };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.QuizShuffle = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
