/**
 * quiz-engine.js
 * ------------------------------------------------------------------
 * Quản lý trạng thái 1 lượt làm bài: câu hiện tại, chấm điểm theo LẦN TRẢ LỜI
 * ĐẦU TIÊN của mỗi câu (trả lời lại sau đó không ảnh hưởng điểm), và tổng hợp
 * danh sách câu đã sai để phục vụ tính năng "Làm lại các câu đã sai".
 *
 * Hỗ trợ cấu hình mỗi lượt làm bài:
 *  - count: số câu hỏi lấy ra làm (null = lấy tất cả)
 *  - mode: 'shuffle' (đảo thứ tự câu hỏi trước khi chọn/hiển thị)
 *          'order'   (giữ nguyên thứ tự câu hỏi gốc)
 *    Lưu ý: dù chọn mode nào, vị trí đáp án A/B/C/D của TỪNG câu vẫn luôn
 *    được đảo — đây là yêu cầu cố định, không phụ thuộc vào mode.
 *
 * Mỗi lần người dùng trả lời SAI một câu, vị trí đáp án A/B/C/D của câu đó
 * sẽ được xáo lại ngay (reshuffleCurrentQuestion) trước khi cho trả lời lại,
 * để tránh việc "học vẹt vị trí" thay vì học nội dung.
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const { shuffleArray, shuffleQuestionOptions, isAnswerCorrect } =
    global.QuizShuffle || require('./shuffle.js');

  function createEngine() {
    const state = {
      bank: [],              // toàn bộ câu hỏi gốc đã import (không đổi trong suốt phiên làm việc)
      sessionQuestions: [],  // câu hỏi của lượt hiện tại, đã đảo thứ tự + đảo đáp án
      currentIndex: 0,
      correctCount: 0,
      wrongQuestionIds: []   // id các câu TRẢ LỜI SAI ở lần đầu, trong lượt hiện tại
    };

    /** Nạp toàn bộ ngân hàng câu hỏi (chỉ gọi khi import đề mới). */
    function setBank(questions) {
      state.bank = questions;
    }

    function toSessionQuestion(question) {
      const shuffled = shuffleQuestionOptions(question);
      return {
        ...shuffled,
        attempted: false,
        firstAttemptCorrect: null
      };
    }

    /**
     * Bắt đầu một lượt làm bài mới.
     * @param {Array} sourceQuestions - danh sách câu hỏi nguồn (bank đầy đủ hoặc tập câu đã sai)
     * @param {Object} [options]
     * @param {'shuffle'|'order'} [options.mode='shuffle'] - có đảo thứ tự câu hỏi hay giữ nguyên
     * @param {number|null} [options.count=null] - số câu lấy ra (null = lấy hết)
     */
    function startSession(sourceQuestions, options) {
      const mode = (options && options.mode) || 'shuffle';
      const count = (options && options.count) || null;

      let pool = sourceQuestions.slice();

      if (mode === 'shuffle') {
        pool = shuffleArray(pool);
      }
      // mode === 'order' -> giữ nguyên thứ tự gốc trong pool

      if (count && count < pool.length) {
        pool = pool.slice(0, count);
      }

      // Dù mode nào, đáp án A/B/C/D của từng câu luôn được đảo.
      state.sessionQuestions = pool.map(toSessionQuestion);
      state.currentIndex = 0;
      state.correctCount = 0;
      state.wrongQuestionIds = [];
    }

    function getCurrentQuestion() {
      return state.sessionQuestions[state.currentIndex] || null;
    }

    function getProgress() {
      return {
        current: state.currentIndex + 1,
        total: state.sessionQuestions.length,
        correctSoFar: state.correctCount
      };
    }

    /**
     * Xử lý khi người dùng chọn 1 đáp án cho câu hiện tại.
     * Trả về: { correct, sessionFinished }
     */
    function submitAnswer(selectedIndex) {
      const q = state.sessionQuestions[state.currentIndex];
      if (!q) return null;

      const correct = isAnswerCorrect(q, selectedIndex);

      // Chỉ tính điểm & ghi nhận câu sai ở LẦN ĐẦU trả lời câu này.
      if (!q.attempted) {
        q.attempted = true;
        q.firstAttemptCorrect = correct;
        // Đóng băng lại đúng trạng thái hiển thị (thứ tự đáp án + đáp án đã
        // chọn + đáp án đúng) tại thời điểm trả lời LẦN ĐẦU, phục vụ tính
        // năng "coi lại câu hỏi". Nếu sau đó câu này bị xáo lại (do trả lời
        // sai, xem reshuffleCurrentQuestion), các trường review* này KHÔNG
        // đổi theo — màn hình coi lại luôn hiển thị đúng như lúc người dùng
        // thực sự đã bấm chọn ở lần đầu tiên.
        q.reviewOptions = q.options.slice();
        q.reviewCorrectIndex = q.correctIndex;
        q.reviewSelectedIndex = selectedIndex;
        if (correct) {
          state.correctCount++;
        } else {
          state.wrongQuestionIds.push(q.id);
        }
      }

      const result = { correct, sessionFinished: false };

      if (correct) {
        const isLast = state.currentIndex >= state.sessionQuestions.length - 1;
        if (isLast) {
          result.sessionFinished = true;
        } else {
          state.currentIndex++;
        }
      }
      // Nếu sai: KHÔNG tăng currentIndex -> bắt buộc trả lời lại câu này.

      return result;
    }

    /**
     * Xáo lại vị trí đáp án A/B/C/D của CÂU HIỆN TẠI (dùng sau khi trả lời sai,
     * để lần trả lời lại không còn giữ nguyên thứ tự cũ). Không ảnh hưởng điểm
     * hay trạng thái "attempted" đã ghi nhận trước đó.
     */
    function reshuffleCurrentQuestion() {
      const current = state.sessionQuestions[state.currentIndex];
      if (!current) return null;

      const reshuffled = shuffleQuestionOptions(current);
      const updated = {
        ...current,
        options: reshuffled.options,
        correctIndex: reshuffled.correctIndex
      };
      state.sessionQuestions[state.currentIndex] = updated;
      return updated;
    }

    /** Tính kết quả cuối lượt: số đúng, tổng, điểm (làm tròn 2 chữ số thập phân). */
    function getFinalResult() {
      const total = state.sessionQuestions.length;
      const correct = state.correctCount;
      const score = total > 0 ? Math.round((correct / total) * 100 * 100) / 100 : 0;

      // Map id câu sai về đúng object gốc trong bank (nội dung/đáp án chưa bị đảo)
      // để lượt luyện tập tiếp theo đảo lại từ đầu, không đảo chồng lên dữ liệu đã đảo.
      const wrongOriginalQuestions = state.wrongQuestionIds
        .map(id => state.bank.find(q => q.id === id))
        .filter(Boolean);

      return { correct, total, score, wrongOriginalQuestions };
    }

    function getBank() {
      return state.bank;
    }

    /** Chỉ số (0-based) của câu đang làm hiện tại trong phiên. */
    function getCurrentIndex() {
      return state.currentIndex;
    }

    /** Tổng số câu trong phiên làm bài hiện tại. */
    function getSessionLength() {
      return state.sessionQuestions.length;
    }

    /**
     * Lấy câu hỏi tại vị trí bất kỳ trong phiên (dùng để coi lại các câu đã
     * qua). Trả về object đã có sẵn reviewOptions/reviewCorrectIndex/
     * reviewSelectedIndex (nếu câu đó đã từng được trả lời).
     */
    function getQuestionAt(index) {
      return state.sessionQuestions[index] || null;
    }

    return {
      setBank,
      startSession,
      getCurrentQuestion,
      getProgress,
      submitAnswer,
      reshuffleCurrentQuestion,
      getFinalResult,
      getBank,
      getCurrentIndex,
      getSessionLength,
      getQuestionAt
    };
  }

  const api = { createEngine };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.QuizEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
