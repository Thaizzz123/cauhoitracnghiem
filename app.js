/**
 * app.js
 * ------------------------------------------------------------------
 * Điều phối chính của ứng dụng: quản lý chuyển màn hình và kết nối
 * parser.js -> quiz-engine.js -> ui.js. Không chứa logic parse/shuffle/
 * chấm điểm (đã tách riêng ở các module tương ứng).
 * ------------------------------------------------------------------
 */

(function () {
  'use strict';

  const engine = window.QuizEngine.createEngine();
  let lastFinalResult = null;   // kết quả lượt vừa xong, phục vụ nút "Làm lại các câu đã sai"
  let currentBank = [];         // câu hỏi hợp lệ vừa parse được, chờ cấu hình để bắt đầu
  let selectedCount = null;     // số câu được chọn ở màn hình cấu hình (null = tất cả)
  let selectedMode = 'shuffle'; // 'shuffle' | 'order'

  // Chỉ số (0-based) của câu ĐANG ĐƯỢC XEM trên màn hình, có thể khác với
  // câu đang làm thật (engine.getCurrentIndex()) khi người dùng bấm "<-" hoặc
  // chọn 1 câu cũ trong menu để coi lại. viewedIndex === engine.getCurrentIndex()
  // nghĩa là đang ở câu sống (live), cho phép bấm chọn đáp án bình thường.
  let viewedIndex = 0;

  // Danh sách file đã tải lên, giữ đúng thứ tự upload (dữ liệu chỉ tồn tại
  // tạm thời trong bộ nhớ của tab hiện tại — reset trang là mất, đúng như
  // toàn bộ dữ liệu khác của app này).
  // Mỗi phần tử: { id, name, status: 'reading'|'ready'|'error', text, errorMsg }
  let uploadedFiles = [];
  let fileIdCounter = 0;

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  /**
   * Hiển thị câu tại vị trí `index` trong phiên hiện tại.
   *  - Nếu index chính là câu đang làm thật (live) -> render bình thường,
   *    cho phép chọn đáp án.
   *  - Nếu index là 1 câu ĐÃ QUA (< câu live) -> render ở chế độ CHỈ XEM
   *    (coi lại), tô xanh đáp án đúng / đỏ đáp án đã chọn sai, không cho bấm.
   */
  function showQuestionAtIndex(index) {
    const total = engine.getSessionLength();
    if (total === 0) return;

    const liveIndex = engine.getCurrentIndex();
    const clamped = Math.max(0, Math.min(index, liveIndex));
    viewedIndex = clamped;

    const question = engine.getQuestionAt(viewedIndex);
    if (!question) return;

    const progress = engine.getProgress();
    const displayProgress = {
      current: viewedIndex + 1,
      total,
      correctSoFar: progress.correctSoFar,
      liveCurrent: liveIndex + 1
    };

    if (viewedIndex === liveIndex) {
      window.QuizUI.renderQuestion(question, displayProgress, handleSelectOption);
    } else {
      window.QuizUI.renderQuestionReview(question, displayProgress);
    }

    window.QuizUI.updateQuizNav(viewedIndex, liveIndex);
  }

  function renderCurrentQuestion() {
    if (!engine.getCurrentQuestion()) {
      finishSession();
      return;
    }
    showQuestionAtIndex(engine.getCurrentIndex());
  }

  function handleSelectOption(selectedIdx, selectedBtn) {
    // Chỉ cho phép trả lời khi đang thực sự ở câu live (nút đáp án ở chế độ
    // coi lại đã bị disable từ UI nên trường hợp này không xảy ra, nhưng vẫn
    // chặn lại cho chắc).
    if (viewedIndex !== engine.getCurrentIndex()) return;

    const result = engine.submitAnswer(selectedIdx);

    window.QuizUI.showAnswerFeedback(result.correct, selectedBtn, () => {
      if (result.correct) {
        if (result.sessionFinished) {
          finishSession();
        } else {
          showQuestionAtIndex(engine.getCurrentIndex());
        }
      } else {
        // Sai: xáo lại vị trí A/B/C/D của CHÍNH câu này rồi cho chọn lại,
        // để tránh việc chỉ nhớ vị trí thay vì nhớ nội dung đáp án đúng.
        const reshuffled = engine.reshuffleCurrentQuestion();
        window.QuizUI.renderOptionsList(reshuffled, handleSelectOption);
      }
    });
  }

  function finishSession() {
    lastFinalResult = engine.getFinalResult();
    window.QuizUI.renderResult(lastFinalResult);
    window.QuizUI.closeQuestionListModal();
    showScreen('screen-result');
  }

  function goToConfigScreen() {
    // Nếu còn file nào chưa đọc xong (đang 'reading'), chặn lại và báo cho
    // người dùng đợi thay vì âm thầm bỏ qua nội dung file đó.
    const stillReading = uploadedFiles.some(f => f.status === 'reading');
    if (stillReading) {
      window.QuizUI.renderErrors([{
        number: null,
        source: '',
        snippet: '',
        reason: 'Còn file đang đọc dở, đợi vài giây rồi bấm "Tiếp tục" lại nhé.'
      }]);
      return;
    }

    // Nguồn 1: nội dung gõ tay trong textarea (nếu có) — luôn được tính
    // TRƯỚC tất cả file, vì đây là nội dung đã có sẵn trong ô nhập.
    // Nguồn 2..N: từng file, theo đúng thứ tự đã tải lên (uploadedFiles đã
    // luôn được append vào cuối mảng theo thời điểm chọn/đọc).
    const sources = [
      { label: 'Nội dung nhập tay', text: document.getElementById('input-textarea').value }
    ];
    uploadedFiles
      .filter(f => f.status === 'ready')
      .forEach(f => sources.push({ label: f.name, text: f.text }));

    const { questions, errors } = window.QuizParser.parseMultipleQuizTexts(sources);

    window.QuizUI.renderErrors(errors);

    if (questions.length === 0) {
      // Không có câu nào hợp lệ -> không cho đi tiếp.
      return;
    }

    currentBank = questions;
    engine.setBank(questions);

    window.QuizUI.renderConfigTotal(currentBank.length);
    window.QuizUI.renderCountChips(currentBank.length, count => {
      selectedCount = count;
    });
    selectedMode = 'shuffle';

    showScreen('screen-config');
  }

  function beginQuizFromConfig() {
    engine.startSession(currentBank, { mode: selectedMode, count: selectedCount });
    viewedIndex = 0;
    showScreen('screen-quiz');
    renderCurrentQuestion();
  }

  // ---------------- Upload file ----------------

  function reRenderFileList() {
    window.QuizUI.renderFileList(uploadedFiles, handleRemoveFile);
  }

  function handleRemoveFile(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    reRenderFileList();
  }

  function isDocxFile(file) {
    const nameLower = (file.name || '').toLowerCase();
    return nameLower.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Không đọc được nội dung file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsPlainText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không đọc được nội dung file.'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Đọc nội dung 1 file thành văn bản thuần để đưa vào parser:
   *  - File .docx: giải nén bằng mammoth.js (đọc trực tiếp arrayBuffer, không
   *    cần convert tay sang .txt trước). File .docx thực chất là 1 file zip,
   *    nếu đọc thẳng như text thuần sẽ ra toàn ký tự rác (mở đầu bằng "PK"),
   *    nên bắt buộc phải qua bước giải nén này.
   *  - File .txt (hoặc bất kỳ file text nào khác): đọc thẳng như trước.
   */
  function readFileContent(file) {
    if (isDocxFile(file)) {
      if (typeof window.mammoth === 'undefined') {
        return Promise.reject(new Error(
          'Chưa tải được thư viện đọc file .docx (có thể do mất mạng). Thử lại hoặc dùng file .txt.'
        ));
      }
      return readFileAsArrayBuffer(file).then(arrayBuffer =>
        window.mammoth.extractRawText({ arrayBuffer })
          .then(result => result.value)
          .catch(() => {
            throw new Error('File .docx bị lỗi hoặc không đúng định dạng Word, không đọc được nội dung.');
          })
      );
    }
    return readFileAsPlainText(file);
  }

  function handleFilesSelected(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const entry = {
        id: 'f' + (++fileIdCounter),
        name: file.name,
        status: 'reading',
        text: '',
        errorMsg: ''
      };
      // Thêm vào CUỐI danh sách hiện có -> giữ đúng nguyên tắc "up trước tính
      // trước": file/lượt chọn nào thêm vào trước sẽ đứng trước trong mảng,
      // và do đó được đánh số câu hỏi trước khi gộp nguồn ở goToConfigScreen.
      uploadedFiles.push(entry);

      readFileContent(file)
        .then(text => {
          entry.status = 'ready';
          entry.text = text;
        })
        .catch(err => {
          entry.status = 'error';
          entry.errorMsg = err.message || 'Không đọc được file.';
        })
        .finally(() => {
          reRenderFileList();
        });
    });

    reRenderFileList();
  }

  function resetFileUploads() {
    uploadedFiles = [];
    reRenderFileList();
  }



  document.getElementById('btn-go-input').addEventListener('click', () => {
    showScreen('screen-input');
  });

  document.getElementById('btn-back-home').addEventListener('click', () => {
    showScreen('screen-home');
  });

  document.getElementById('btn-go-config').addEventListener('click', goToConfigScreen);

  document.getElementById('input-file').addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
    // Reset value để cho phép chọn lại đúng những file đó ở lượt sau
    // (browser không bắn change event nếu chọn lại y hệt FileList cũ).
    e.target.value = '';
  });

  document.getElementById('btn-back-input').addEventListener('click', () => {
    showScreen('screen-input');
  });

  document.getElementById('btn-begin-quiz').addEventListener('click', beginQuizFromConfig);

  window.QuizUI.wireModeChips(mode => {
    selectedMode = mode;
  });

  document.getElementById('btn-retry-wrong').addEventListener('click', () => {
    if (!lastFinalResult || lastFinalResult.wrongOriginalQuestions.length === 0) return;
    // Luôn xáo cả thứ tự câu lẫn đáp án cho lượt luyện lại câu sai.
    engine.startSession(lastFinalResult.wrongOriginalQuestions, { mode: 'shuffle', count: null });
    viewedIndex = 0;
    showScreen('screen-quiz');
    renderCurrentQuestion();
  });

  document.getElementById('btn-retry-all').addEventListener('click', () => {
    window.QuizUI.renderConfigTotal(currentBank.length);
    window.QuizUI.renderCountChips(currentBank.length, count => {
      selectedCount = count;
    });
    showScreen('screen-config');
  });

  document.getElementById('btn-new-quiz').addEventListener('click', () => {
    document.getElementById('input-textarea').value = '';
    resetFileUploads();
    window.QuizUI.renderErrors([]);
    showScreen('screen-input');
  });

  // ---------------- Coi lại câu hỏi (review mode) ----------------

  // Nút "<-" góc dưới trái: lùi lại xem câu ngay trước câu đang xem.
  document.getElementById('btn-quiz-back').addEventListener('click', () => {
    showQuestionAtIndex(viewedIndex - 1);
  });

  // Nút "☰" góc dưới phải: mở menu liệt kê toàn bộ câu trong phiên.
  document.getElementById('btn-quiz-list').addEventListener('click', () => {
    window.QuizUI.renderQuestionListMenu(
      sessionSnapshot(),
      engine.getCurrentIndex(),
      (idx) => {
        window.QuizUI.closeQuestionListModal();
        showQuestionAtIndex(idx);
      }
    );
    window.QuizUI.openQuestionListModal();
  });

  document.getElementById('btn-close-question-list').addEventListener('click', () => {
    window.QuizUI.closeQuestionListModal();
  });

  // Bấm ra ngoài panel (vùng overlay tối) cũng đóng menu.
  document.getElementById('question-list-modal').addEventListener('click', (e) => {
    if (e.target.id === 'question-list-modal') {
      window.QuizUI.closeQuestionListModal();
    }
  });

  // Banner "Đang xem lại" -> quay về đúng câu đang làm thật.
  document.getElementById('btn-review-back-live').addEventListener('click', () => {
    showQuestionAtIndex(engine.getCurrentIndex());
  });

  /** Lấy toàn bộ câu trong phiên hiện tại (0..total-1) để hiển thị menu. */
  function sessionSnapshot() {
    const total = engine.getSessionLength();
    const arr = [];
    for (let i = 0; i < total; i++) {
      arr.push(engine.getQuestionAt(i));
    }
    return arr;
  }

})();
