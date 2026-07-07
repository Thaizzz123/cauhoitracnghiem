/**
 * quiz-engine.js
 * ------------------------------------------------------------------
 * Quản lý trạng thái 1 lượt làm bài: câu hiện tại, chấm điểm theo LẦN TRẢ LỜI
 * ĐẦU TIÊN của mỗi câu (trả lời lại sau đó không ảnh hưởng điểm), và tổng hợp
 * danh sách câu đã sai để phục vụ tính năng "Làm lại các câu đã sai".
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const { buildSession, isAnswerCorrect } = global.QuizShuffle || require('./shuffle.js');

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

    /**
     * Bắt đầu một lượt làm bài mới từ danh sách câu hỏi nguồn (có thể là toàn bộ
     * bank, hoặc chỉ tập con các câu đã sai). Luôn đảo thứ tự câu + đảo đáp án.
     */
    function startSession(sourceQuestions) {
      state.sessionQuestions = buildSession(sourceQuestions).map(q => ({
        ...q,
        attempted: false,
        firstAttemptCorrect: null
      }));
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
        total: state.sessionQuestions.length
      };
    }

    /**
     * Xử lý khi người dùng chọn 1 đáp án cho câu hiện tại.
     * Trả về: { correct, isLastQuestion, sessionFinished }
     */
    function submitAnswer(selectedIndex) {
      const q = state.sessionQuestions[state.currentIndex];
      if (!q) return null;

      const correct = isAnswerCorrect(q, selectedIndex);

      // Chỉ tính điểm & ghi nhận câu sai ở LẦN ĐẦU trả lời câu này.
      if (!q.attempted) {
        q.attempted = true;
        q.firstAttemptCorrect = correct;
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

    return {
      setBank,
      startSession,
      getCurrentQuestion,
      getProgress,
      submitAnswer,
      getFinalResult,
      getBank
    };
  }

  const api = { createEngine };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.QuizEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
