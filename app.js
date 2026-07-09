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

  function renderCurrentQuestion() {
    const question = engine.getCurrentQuestion();
    const progress = engine.getProgress();

    if (!question) {
      finishSession();
      return;
    }

    window.QuizUI.renderQuestion(question, progress, handleSelectOption);
  }

  function handleSelectOption(selectedIdx, selectedBtn) {
    const result = engine.submitAnswer(selectedIdx);

    window.QuizUI.showAnswerFeedback(result.correct, selectedBtn, () => {
      if (result.correct) {
        if (result.sessionFinished) {
          finishSession();
        } else {
          renderCurrentQuestion();
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

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không đọc được nội dung file.'));
      reader.readAsText(file, 'UTF-8');
    });
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

      readFileAsText(file)
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

})();
