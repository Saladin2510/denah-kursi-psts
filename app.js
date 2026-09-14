/**
 * DENAH TEMPAT DUDUK PSTS - LOGIC & CONTROLLER
 * Mengatur pemrosesan data Excel, algoritma denah mengular,
 * pencarian siswa multi-ruang, dan fungsi cetak A4/F4.
 */

(function () {
  'use strict';

  // --- APPLICATION STATE ---
  let roomsData = [];
  let currentRoomIndex = 0;
  let fillFrontFirst = true; // Kursi depan harus selalu terisi (default true)
  let showArrows = true;
  let supervisorPos = 'right'; // 'right' | 'left'
  let paperSize = 'a4-landscape';
  let activeView = 'denah'; // 'denah' | 'table'
  let focusedSaf = 'all'; // 'all' | '0' | '1' | '2' | '3'
  let currentZoom = 1.0;

  // --- DOM ELEMENTS ---
  const roomSelect = document.getElementById('roomSelect');
  const roomPillsContainer = document.getElementById('roomPillsContainer');
  const btnPrevRoom = document.getElementById('btnPrevRoom');
  const btnNextRoom = document.getElementById('btnNextRoom');
  const singleRoomContainer = document.getElementById('singleRoomContainer');
  const tableViewContainer = document.getElementById('tableViewContainer');
  const batchPrintContainer = document.getElementById('batchPrintContainer');
  const roomViewport = document.getElementById('roomViewport');

  const globalStudentSearch = document.getElementById('globalStudentSearch');
  const searchResultsDropdown = document.getElementById('searchResultsDropdown');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  const excelFileInput = document.getElementById('excelFileInput');
  const btnResetDefault = document.getElementById('btnResetDefault');
  const btnPrintSingle = document.getElementById('btnPrintSingle');
  const btnPrintBatch = document.getElementById('btnPrintBatch');

  const btnViewDenah = document.getElementById('btnViewDenah');
  const btnViewTable = document.getElementById('btnViewTable');

  const chkFillFront = document.getElementById('chkFillFront');
  const chkShowArrows = document.getElementById('chkShowArrows');
  const selSupervisorPos = document.getElementById('selSupervisorPos');
  const selPaperSize = document.getElementById('selPaperSize');

  const safBtnGroup = document.getElementById('safBtnGroup');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomFit = document.getElementById('btnZoomFit');
  const zoomLabel = document.getElementById('zoomLabel');

  const notificationBanner = document.getElementById('notificationBanner');
  const searchHighlightToast = document.getElementById('searchHighlightToast');
  const toastStudentName = document.getElementById('toastStudentName');
  const toastStudentInfo = document.getElementById('toastStudentInfo');
  const toastCloseBtn = document.getElementById('toastCloseBtn');

  // --- INITIALIZATION ---
  function init() {
    // 1. Muat data bawaan jika tersedia di window.DEFAULT_ROOMS_DATA
    if (window.DEFAULT_ROOMS_DATA && Array.isArray(window.DEFAULT_ROOMS_DATA) && window.DEFAULT_ROOMS_DATA.length > 0) {
      roomsData = window.DEFAULT_ROOMS_DATA;
    } else {
      roomsData = generateFallbackData();
    }

    // 2. Pasang event listeners
    bindEvents();

    // 3. Render kontrol dan denah pertama kali
    updateRoomSelectorUI();
    renderCurrentRoom();
  }

  // --- EVENT LISTENERS ---
  function bindEvents() {
    roomSelect.addEventListener('change', (e) => {
      currentRoomIndex = parseInt(e.target.value, 10) || 0;
      onRoomChanged();
    });

    btnPrevRoom.addEventListener('click', () => {
      if (currentRoomIndex > 0) {
        currentRoomIndex--;
        onRoomChanged();
      }
    });

    btnNextRoom.addEventListener('click', () => {
      if (currentRoomIndex < roomsData.length - 1) {
        currentRoomIndex++;
        onRoomChanged();
      }
    });

    // Toggle View (Denah vs Tabel)
    btnViewDenah.addEventListener('click', () => {
      activeView = 'denah';
      btnViewDenah.classList.add('active');
      btnViewTable.classList.remove('active');
      singleRoomContainer.style.display = 'block';
      tableViewContainer.style.display = 'none';
      renderCurrentRoom();
    });

    btnViewTable.addEventListener('click', () => {
      activeView = 'table';
      btnViewTable.classList.add('active');
      btnViewDenah.classList.remove('active');
      singleRoomContainer.style.display = 'none';
      tableViewContainer.style.display = 'block';
      renderTableView();
    });

    // Pengaturan Opsi Denah
    chkFillFront.addEventListener('change', (e) => {
      fillFrontFirst = e.target.checked;
      renderCurrentRoom();
    });

    chkShowArrows.addEventListener('change', (e) => {
      showArrows = e.target.checked;
      renderCurrentRoom();
    });

    selSupervisorPos.addEventListener('change', (e) => {
      supervisorPos = e.target.value;
      renderCurrentRoom();
    });

    selPaperSize.addEventListener('change', (e) => {
      paperSize = e.target.value;
      applyPaperSize(paperSize);
    });

    // Cetak
    btnPrintSingle.addEventListener('click', () => {
      window.print();
    });

    btnPrintBatch.addEventListener('click', () => {
      prepareBatchPrint();
    });

    // Upload Excel
    excelFileInput.addEventListener('change', handleExcelUpload);

    // Reset ke data asli
    btnResetDefault.addEventListener('click', () => {
      if (window.DEFAULT_ROOMS_DATA) {
        roomsData = window.DEFAULT_ROOMS_DATA;
        currentRoomIndex = 0;
        updateRoomSelectorUI();
        renderCurrentRoom();
        showNotification('Data asli dari 24 Ruangan berhasil dimuat ulang!', 'success');
      }
    });

    // Pencarian Siswa
    globalStudentSearch.addEventListener('input', handleSearchInput);
    clearSearchBtn.addEventListener('click', () => {
      globalStudentSearch.value = '';
      clearSearchBtn.style.display = 'none';
      searchResultsDropdown.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!searchResultsDropdown.contains(e.target) && e.target !== globalStudentSearch) {
        searchResultsDropdown.style.display = 'none';
      }
    });

    toastCloseBtn.addEventListener('click', () => {
      searchHighlightToast.style.display = 'none';
    });

    // Mobile Saf Filter Buttons
    if (safBtnGroup) {
      safBtnGroup.querySelectorAll('.saf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          safBtnGroup.querySelectorAll('.saf-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          focusedSaf = btn.dataset.saf;
          renderCurrentRoom();
        });
      });
    }

    // Zoom Controls
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => setZoom(currentZoom + 0.1));
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => setZoom(currentZoom - 0.1));
    }
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', zoomFit);
    }
  }

  function setZoom(val) {
    currentZoom = Math.max(0.45, Math.min(1.5, Math.round(val * 100) / 100));
    if (currentZoom === 1.0) {
      singleRoomContainer.style.transform = '';
      singleRoomContainer.style.width = '100%';
    } else {
      singleRoomContainer.style.transform = `scale(${currentZoom})`;
      singleRoomContainer.style.width = `${100 / currentZoom}%`;
    }
    if (zoomLabel) zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  function zoomFit() {
    if (!roomViewport) return;
    const viewportWidth = roomViewport.clientWidth - 16;
    const targetWidth = 800;
    if (viewportWidth < targetWidth) {
      const scale = Math.max(0.45, viewportWidth / targetWidth);
      setZoom(scale);
    } else {
      setZoom(1.0);
    }
  }

  function applyPaperSize(size) {
    document.body.classList.remove('print-portrait', 'print-f4');
    if (size === 'a4-portrait') {
      document.body.classList.add('print-portrait');
    } else if (size === 'f4-landscape') {
      document.body.classList.add('print-f4');
    }
  }

  function onRoomChanged() {
    roomSelect.value = currentRoomIndex;
    updateRoomPills();
    if (activeView === 'denah') {
      renderCurrentRoom();
    } else {
      renderTableView();
    }
  }

  function showNotification(msg, type = 'info') {
    notificationBanner.textContent = msg;
    notificationBanner.className = `notification-banner ${type} no-print`;
    notificationBanner.style.display = 'block';
    setTimeout(() => {
      notificationBanner.style.display = 'none';
    }, 4000);
  }

  // --- UI CONTROLS: ROOM SELECTOR & PILLS ---
  function updateRoomSelectorUI() {
    roomSelect.innerHTML = '';
    roomPillsContainer.innerHTML = '';

    roomsData.forEach((room, idx) => {
      // Dropdown option
      const opt = document.createElement('option');
      opt.value = idx;
      const classInfo = [room.class_left, room.class_right].filter(Boolean).join(' & ') || 'Siswa';
      opt.textContent = `${room.code} (${room.nama_ruang || 'Ruang'}) • ${classInfo} (${room.total_students} Siswa)`;
      roomSelect.appendChild(opt);

      // Horizontal Pill
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `room-pill ${idx === currentRoomIndex ? 'active' : ''}`;
      pill.textContent = room.code;
      pill.title = `${room.nama_ruang || ''} - ${classInfo}`;
      pill.addEventListener('click', () => {
        currentRoomIndex = idx;
        onRoomChanged();
      });
      roomPillsContainer.appendChild(pill);
    });

    roomSelect.value = currentRoomIndex;
  }

  function updateRoomPills() {
    const pills = roomPillsContainer.querySelectorAll('.room-pill');
    pills.forEach((p, idx) => {
      if (idx === currentRoomIndex) {
        p.classList.add('active');
        p.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        p.classList.remove('active');
      }
    });
  }

  // --- ALGORITMA DENAH MENGULAR (SNAKE SEATING CHART) ---
  /**
   * Menghitung posisi koordinat (row, col) setiap nomor meja 1..totalDesks
   * sesuai format 4 Saf (kolom) x N Banjar (baris) mengular.
   *
   * @param {number} totalDesks - Jumlah meja yang dibutuhkan
   * @param {boolean} fillFront - Apakah meja depan wajib terisi semua
   * @param {string} supPos - Posisi meja pengawas ('right' atau 'left')
   * @returns {Array} grid of cells [row][col]
   */
  function calculateSeatingGrid(totalDesks, fillFront = true, supPos = 'right') {
    const numCols = 4; // 4 Saf
    const numRows = Math.max(4, Math.ceil(totalDesks / numCols)); // Min 4 baris, bisa 5 jika >16 meja

    // Inisialisasi grid kosong numRows x numCols
    const grid = Array.from({ length: numRows }, () => Array(numCols).fill(null));

    // Urutan kolom dari sudut pandang meja pengawas
    // Jika pengawas di Kanan:
    // Saf 4 (Col 3, Kanan Depan) -> Saf 3 (Col 2) -> Saf 2 (Col 1) -> Saf 1 (Col 0, Kiri)
    // Jika pengawas di Kiri:
    // Saf 1 (Col 0, Kiri Depan) -> Saf 2 (Col 1) -> Saf 3 (Col 2) -> Saf 4 (Col 3, Kanan)
    const colOrder = supPos === 'right' ? [3, 2, 1, 0] : [0, 1, 2, 3];

    let deskNum = 1;

    for (let cIdx = 0; cIdx < colOrder.length; cIdx++) {
      const col = colOrder[cIdx];
      // Arah alur:
      // Kolom 0 (pertama): Turun (Depan ke Belakang: row 0 -> numRows-1)
      // Kolom 1 (kedua): Naik (Belakang ke Depan: row numRows-1 -> 0)
      // Kolom 2 (ketiga): Turun (Depan ke Belakang: row 0 -> numRows-1)
      // Kolom 3 (keempat/terakhir): Naik (Belakang ke Depan)
      const isGoingDown = (cIdx % 2 === 0);

      // Hitung berapa meja yang tersisa untuk kolom ini
      const remainingDesks = totalDesks - (deskNum - 1);
      const desksInThisCol = Math.min(numRows, Math.max(0, remainingDesks));

      if (desksInThisCol <= 0) break;

      if (isGoingDown) {
        // Alur ke bawah: baris 0 s.d. desksInThisCol - 1
        for (let r = 0; r < desksInThisCol; r++) {
          grid[r][col] = {
            deskNumber: deskNum++,
            direction: 'down',
            colIndex: col,
            rowIndex: r
          };
        }
      } else {
        // Alur ke atas:
        // Cek apakah kolom ini adalah kolom terakhir dan jumlah mejanya tidak penuh (misal 3 meja dari 4 baris)
        const isLastColWithPartial = (desksInThisCol < numRows);

        if (isLastColWithPartial && fillFront) {
          // ATURAN KHUSUS: Kursi depan harus terisi semua!
          // Jika alur naik dan hanya ada 3 meja (misal 13, 14, 15),
          // meja-meja tersebut dipadatkan ke baris depan (row 0, 1, 2) sehingga baris depan (row 0) terisi Meja 15!
          // Meja kosong berada di baris belakang (row 3).
          // Meja dialokasikan: baris teratas (row 0) adalah meja terbesar di kolom ini.
          const startDesk = deskNum;
          const endDesk = deskNum + desksInThisCol - 1;

          // Urutan baris dari belakang ke depan pada area yang terisi:
          // baris (desksInThisCol - 1) -> meja 13
          // ...
          // baris 0 (depan) -> meja 15
          for (let r = desksInThisCol - 1; r >= 0; r--) {
            grid[r][col] = {
              deskNumber: deskNum++,
              direction: 'up',
              colIndex: col,
              rowIndex: r
            };
          }
        } else {
          // Alur naik biasa (mulai dari baris paling bawah numRows - 1 ke atas)
          for (let r = numRows - 1; r >= numRows - desksInThisCol; r--) {
            grid[r][col] = {
              deskNumber: deskNum++,
              direction: 'up',
              colIndex: col,
              rowIndex: r
            };
          }
        }
      }
    }

    return { grid, numRows, numCols };
  }

  // --- RENDER SINGLE ROOM SEATING PLAN ---
  function renderCurrentRoom(targetContainer = singleRoomContainer, room = null, isBatch = false) {
    const currentRoom = room || roomsData[currentRoomIndex];
    if (!currentRoom) return;

    const studentsLeft = currentRoom.students_left || [];
    const studentsRight = currentRoom.students_right || [];
    const totalDesks = Math.max(studentsLeft.length, studentsRight.length, 1);

    const { grid, numRows, numCols } = calculateSeatingGrid(totalDesks, fillFrontFirst, supervisorPos);

    const isSafFocused = (!isBatch && focusedSaf !== 'all');
    const targetCol = isSafFocused ? parseInt(focusedSaf, 10) : null;
    const safLabels = ['SAF 1 (KIRI)', 'SAF 2', 'SAF 3', 'SAF 4 (KANAN)'];

    // Build HTML for Room
    let html = `
      <div class="room-sheet ${isBatch ? 'room-print-page' : ''} ${isSafFocused ? 'room-sheet-saf-focused' : ''}" id="room-sheet-${currentRoom.code.replace(/\s+/g, '-')}">
        <!-- KOP UJIAN -->
        <div class="exam-kop">
          <h2 class="kop-title">DENAH TEMPAT DUDUK PESERTA PSTS</h2>
          <p class="kop-subtitle">PENILAIAN SUMATIF TENGAH SEMESTER • TAHUN AJARAN 2026/2027</p>
          <div class="kop-meta-bar">
            <div class="meta-pill highlight">
              <strong>RUANG:</strong> <span>${currentRoom.no_ruang || currentRoom.code}</span>
            </div>
            <div class="meta-pill">
              <strong>NAMA RUANG:</strong> <span>${currentRoom.nama_ruang || '-'}</span>
            </div>
            <div class="meta-pill">
              <strong>KELAS KIRI:</strong> <span>${currentRoom.class_left || '-'} (${studentsLeft.length} Siswa)</span>
            </div>
            <div class="meta-pill">
              <strong>KELAS KANAN:</strong> <span>${currentRoom.class_right || 'KOSONG'} (${studentsRight.length} Siswa)</span>
            </div>
            <div class="meta-pill">
              <strong>TOTAL PESERTA:</strong> <span>${currentRoom.total_students} Siswa (${totalDesks} Meja)</span>
            </div>
          </div>
        </div>

        <!-- AREA DEPAN KELAS (PAPAN TULIS & PENGAWAS) -->
        <div class="classroom-front">
          <div class="front-stage-bar">
            ${supervisorPos === 'left' ? renderSupervisorDesk() : renderDoorIndicator('Kiri')}
            
            <div class="whiteboard-container">
              <div class="whiteboard">
                <span class="whiteboard-title">PAPAN TULIS / DEPAN RUANGAN</span>
              </div>
              <div class="whiteboard-marker-tray"></div>
            </div>

            ${supervisorPos === 'right' ? renderSupervisorDesk() : renderDoorIndicator('Kanan')}
          </div>

          <!-- HEADER SAF -->
          ${isSafFocused ? `
            <div class="saf-header-row" style="grid-template-columns: 1fr;">
              <div class="saf-badge" style="background: var(--primary); color: #fff; font-weight: 700; padding: 6px; font-size: 0.85rem;">
                TAMPILAN FOKUS: ${safLabels[targetCol]} (Depan ke Belakang)
              </div>
            </div>
          ` : `
            <div class="saf-header-row">
              <div class="saf-badge">SAF 1 (KIRI)</div>
              <div class="saf-badge">SAF 2</div>
              <div class="saf-badge">SAF 3</div>
              <div class="saf-badge">SAF 4 (KANAN)</div>
            </div>
          `}
        </div>

        <!-- GRID MEJA SISWA -->
        <div class="desks-grid ${isSafFocused ? 'saf-focus-active' : ''}">
    `;

    // Render cells in row-major order: row 0 (depan) to row numRows - 1 (belakang)
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (isSafFocused && c !== targetCol) continue;
        const cell = grid[r][c];

        if (!cell) {
          // Meja kosong / cadangan
          html += `
            <div class="empty-desk-card">
              <span class="empty-desk-label">KOSONG</span>
              <span>(Meja Cadangan)</span>
            </div>
          `;
          continue;
        }

        const dNum = cell.deskNumber;
        const studentL = studentsLeft[dNum - 1] || null;
        const studentR = studentsRight[dNum - 1] || null;

        const arrowSymbol = showArrows ? (cell.direction === 'down' ? '⬇' : '⬆') : '';

        html += `
          <div class="desk-card" id="desk-${currentRoom.code.replace(/\s+/g, '-')}-${dNum}" data-desk="${dNum}">
            <!-- Header Meja -->
            <div class="desk-card-header">
              <span class="desk-number">MEJA ${String(dNum).padStart(2, '0')}</span>
              <span class="desk-flow-indicator">${arrowSymbol} Alur ${dNum}</span>
            </div>

            <!-- Kursi Kiri & Kanan -->
            <div class="desk-seats-row">
              <!-- SISI KIRI (GRUP 1) -->
              ${renderSeatSide(studentL, 'left', dNum, currentRoom.class_left)}

              <!-- SISI KANAN (GRUP 2) -->
              ${renderSeatSide(studentR, 'right', dNum, currentRoom.class_right)}
            </div>
          </div>
        `;
      }
    }

    html += `
        </div>

        <!-- FOOTER & TANDA TANGAN UJIAN -->
        <div class="exam-signature-area">
          <div class="exam-rules-note">
            <strong>TATA TERTIB PESERTA PSTS:</strong>
            <ol>
              <li>Siswa duduk sesuai denah dan nomor urut presensi yang telah ditentukan panitia.</li>
              <li>Dilarang menukar posisi tempat duduk tanpa izin Pengawas Ruang.</li>
              <li>Tas, buku, dan gawai/HP diletakkan di depan kelas di bawah papan tulis.</li>
            </ol>
          </div>

          <div class="signature-boxes">
            <div class="sig-col">
              <div class="sig-title">Pengawas Ruang 1</div>
              <div class="sig-line"></div>
              <div class="sig-nip">NIP. .....................................</div>
            </div>
            <div class="sig-col">
              <div class="sig-title">Pengawas Ruang 2</div>
              <div class="sig-line"></div>
              <div class="sig-nip">NIP. .....................................</div>
            </div>
          </div>
        </div>
      </div>
    `;

    targetContainer.innerHTML = html;
  }

  function renderSupervisorDesk() {
    return `
      <div class="supervisor-desk">
        <span class="supervisor-badge">PENGAWAS</span>
        <span class="supervisor-text">Meja Pengawas</span>
      </div>
    `;
  }

  function renderDoorIndicator(side) {
    return `
      <div class="room-door">
        <span>🚪 PINTU MASUK (${side})</span>
      </div>
    `;
  }

  function renderSeatSide(student, side, deskNum, defaultClass) {
    const isLeft = side === 'left';
    const sideClass = isLeft ? 'left-seat' : 'right-seat';

    if (!student) {
      return `
        <div class="seat-side ${sideClass} empty-seat" id="seat-${deskNum}-${side}">
          <span class="seat-empty-watermark">KOSONG</span>
          <span style="font-size: 0.65rem; color: #94a3b8;">${isLeft ? 'Sisi Kiri' : 'Sisi Kanan'}</span>
        </div>
      `;
    }

    return `
      <div class="seat-side ${sideClass}" id="seat-${deskNum}-${side}" data-student-nis="${student.nis || ''}" data-student-name="${escapeHtml(student.nama || '')}">
        <div>
          <div class="seat-badge-row">
            <span class="seat-class-tag">${escapeHtml(student.kelas || defaultClass || (isLeft ? 'Kelas X' : 'Kelas XI'))}</span>
            <span class="seat-no-urut">No. ${String(student.no || deskNum).padStart(2, '0')}</span>
          </div>
          <div class="student-name" title="${escapeHtml(student.nama || '')}">
            ${escapeHtml(student.nama || '-')}
          </div>
        </div>
        <div class="student-details">
          <span class="student-meta-item">NIS: <strong>${escapeHtml(student.nis || '-')}</strong></span>
          <span class="student-meta-item">No Tes: ${escapeHtml(student.no_tes || '-')}</span>
          <span class="student-meta-item">Gender: ${escapeHtml(student.gender || '-')}</span>
        </div>
      </div>
    `;
  }

  // --- RENDER TABLE / ATTENDANCE VIEW ---
  function renderTableView() {
    const currentRoom = roomsData[currentRoomIndex];
    if (!currentRoom) return;

    const studentsLeft = currentRoom.students_left || [];
    const studentsRight = currentRoom.students_right || [];
    const totalDesks = Math.max(studentsLeft.length, studentsRight.length, 1);

    let html = `
      <div class="table-view-card">
        <div class="table-header-title">
          <div>
            <h2>Daftar Peserta & Presensi Ruang ${escapeHtml(currentRoom.code)} (${escapeHtml(currentRoom.nama_ruang || '-')})</h2>
            <p style="font-size: 0.85rem; color: #64748b;">
              ${escapeHtml(currentRoom.class_left)} (${studentsLeft.length}) & ${escapeHtml(currentRoom.class_right || 'Kosong')} (${studentsRight.length}) • Total: ${currentRoom.total_students} Siswa
            </p>
          </div>
          <button class="btn btn-primary" onclick="window.print()">
            🖨️ Cetak Tabel Kehadiran
          </button>
        </div>

        <table class="attendance-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">No Meja</th>
              <th style="width: 70px;">Posisi</th>
              <th style="width: 50px; text-align: center;">No Urut</th>
              <th style="width: 110px;">NIS</th>
              <th style="width: 130px;">No Peserta</th>
              <th>Nama Siswa</th>
              <th style="width: 100px;">Kelas</th>
              <th style="width: 40px; text-align: center;">L/P</th>
              <th style="width: 100px; text-align: center;">Paraf Siswa</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (let d = 1; d <= totalDesks; d++) {
      const sLeft = studentsLeft[d - 1];
      const sRight = studentsRight[d - 1];

      // Baris Kursi Kiri
      if (sLeft) {
        html += `
          <tr>
            <td style="text-align: center; font-weight: 700;">${d}</td>
            <td><span class="badge-tag badge-blue">Kiri</span></td>
            <td style="text-align: center;">${escapeHtml(sLeft.no || d)}</td>
            <td>${escapeHtml(sLeft.nis || '-')}</td>
            <td>${escapeHtml(sLeft.no_tes || '-')}</td>
            <td><strong>${escapeHtml(sLeft.nama || '-')}</strong></td>
            <td>${escapeHtml(sLeft.kelas || currentRoom.class_left)}</td>
            <td style="text-align: center;">${escapeHtml(sLeft.gender || '-')}</td>
            <td style="border-bottom: 1px dashed #cbd5e1;"></td>
          </tr>
        `;
      } else {
        html += `
          <tr style="background: #fafafa; color: #94a3b8;">
            <td style="text-align: center; font-weight: 700;">${d}</td>
            <td><span class="badge-tag" style="background:#e2e8f0; color:#64748b;">Kiri</span></td>
            <td colspan="7" style="font-style: italic;">[Kursi Kosong]</td>
          </tr>
        `;
      }

      // Baris Kursi Kanan
      if (sRight) {
        html += `
          <tr>
            <td style="text-align: center; font-weight: 700;">${d}</td>
            <td><span class="badge-tag badge-green">Kanan</span></td>
            <td style="text-align: center;">${escapeHtml(sRight.no || d)}</td>
            <td>${escapeHtml(sRight.nis || '-')}</td>
            <td>${escapeHtml(sRight.no_tes || '-')}</td>
            <td><strong>${escapeHtml(sRight.nama || '-')}</strong></td>
            <td>${escapeHtml(sRight.kelas || currentRoom.class_right)}</td>
            <td style="text-align: center;">${escapeHtml(sRight.gender || '-')}</td>
            <td style="border-bottom: 1px dashed #cbd5e1;"></td>
          </tr>
        `;
      } else if (currentRoom.class_right) {
        html += `
          <tr style="background: #fafafa; color: #94a3b8;">
            <td style="text-align: center; font-weight: 700;">${d}</td>
            <td><span class="badge-tag" style="background:#e2e8f0; color:#64748b;">Kanan</span></td>
            <td colspan="7" style="font-style: italic;">[Kursi Kosong]</td>
          </tr>
        `;
      }
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    tableViewContainer.innerHTML = html;
  }

  // --- GLOBAL STUDENT SEARCH ---
  function handleSearchInput(e) {
    const query = e.target.value.trim().toLowerCase();

    if (!query) {
      searchResultsDropdown.style.display = 'none';
      clearSearchBtn.style.display = 'none';
      return;
    }

    clearSearchBtn.style.display = 'block';

    const matches = [];

    roomsData.forEach((room, rIdx) => {
      // Search left students
      (room.students_left || []).forEach((s, sIdx) => {
        if (studentMatchesQuery(s, query)) {
          matches.push({
            student: s,
            roomIndex: rIdx,
            roomCode: room.code,
            roomName: room.nama_ruang,
            deskNum: sIdx + 1,
            side: 'left',
            sideLabel: 'Kursi Kiri'
          });
        }
      });

      // Search right students
      (room.students_right || []).forEach((s, sIdx) => {
        if (studentMatchesQuery(s, query)) {
          matches.push({
            student: s,
            roomIndex: rIdx,
            roomCode: room.code,
            roomName: room.nama_ruang,
            deskNum: sIdx + 1,
            side: 'right',
            sideLabel: 'Kursi Kanan'
          });
        }
      });
    });

    renderSearchResults(matches, query);
  }

  function studentMatchesQuery(student, q) {
    if (!student) return false;
    const name = (student.nama || '').toLowerCase();
    const nis = (student.nis || '').toLowerCase();
    const noTes = (student.no_tes || '').toLowerCase();
    return name.includes(q) || nis.includes(q) || noTes.includes(q);
  }

  function renderSearchResults(matches, query) {
    if (matches.length === 0) {
      searchResultsDropdown.innerHTML = `
        <div style="padding: 12px 16px; font-size: 0.82rem; color: #64748b; text-align: center;">
          Tidak ada siswa ditemukan dengan kata kunci "<strong>${escapeHtml(query)}</strong>"
        </div>
      `;
      searchResultsDropdown.style.display = 'block';
      return;
    }

    let html = '';
    matches.slice(0, 20).forEach((item) => {
      html += `
        <div class="search-result-item" data-room-index="${item.roomIndex}" data-desk="${item.deskNum}" data-side="${item.side}">
          <div class="search-item-info">
            <strong>${escapeHtml(item.student.nama)}</strong>
            <span>${escapeHtml(item.student.kelas || '')} • NIS: ${escapeHtml(item.student.nis || '-')} • No: ${escapeHtml(item.student.no || item.deskNum)}</span>
          </div>
          <div class="search-item-badge">
            ${escapeHtml(item.roomCode)} • Meja ${item.deskNum} (${item.sideLabel})
          </div>
        </div>
      `;
    });

    if (matches.length > 20) {
      html += `
        <div style="padding: 8px; text-align: center; font-size: 0.75rem; color: #64748b; background: #f8fafc;">
          Menampilkan 20 dari ${matches.length} siswa ditemukan. Ketik lebih spesifik...
        </div>
      `;
    }

    searchResultsDropdown.innerHTML = html;
    searchResultsDropdown.style.display = 'block';

    // Click handler for result items
    searchResultsDropdown.querySelectorAll('.search-result-item').forEach(itemEl => {
      itemEl.addEventListener('click', () => {
        const rIdx = parseInt(itemEl.dataset.roomIndex, 10);
        const desk = parseInt(itemEl.dataset.desk, 10);
        const side = itemEl.dataset.side;

        currentRoomIndex = rIdx;
        onRoomChanged();
        searchResultsDropdown.style.display = 'none';

        // Berikan delay kecil untuk animasi scroll dan highlight
        setTimeout(() => {
          highlightStudentSeat(rIdx, desk, side);
        }, 150);
      });
    });
  }

  function highlightStudentSeat(rIdx, deskNum, side) {
    const room = roomsData[rIdx];
    const student = (side === 'left' ? room.students_left : room.students_right)[deskNum - 1];

    const deskCard = document.getElementById(`desk-${room.code.replace(/\s+/g, '-')}-${deskNum}`);
    const seatEl = document.getElementById(`seat-${deskNum}-${side}`);

    // Hapus highlight sebelumnya
    document.querySelectorAll('.desk-card.searched-active').forEach(el => el.classList.remove('searched-active'));
    document.querySelectorAll('.seat-side.highlight-target').forEach(el => el.classList.remove('highlight-target'));

    if (deskCard) {
      deskCard.classList.add('searched-active');
      deskCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (seatEl) {
      seatEl.classList.add('highlight-target');
    }

    // Tampilkan Toast
    if (student) {
      toastStudentName.textContent = student.nama;
      toastStudentInfo.textContent = `Duduk di ${room.code} (${room.nama_ruang}) • Meja ${deskNum} (${side === 'left' ? 'Kursi Kiri' : 'Kursi Kanan'}) • Kelas ${student.kelas}`;
      searchHighlightToast.style.display = 'block';

      setTimeout(() => {
        searchHighlightToast.style.display = 'none';
      }, 7000);
    }
  }

  // --- BATCH PRINT ALL ROOMS ---
  function prepareBatchPrint() {
    if (!roomsData || roomsData.length === 0) {
      alert('Tidak ada data ruangan untuk dicetak.');
      return;
    }

    showNotification('Menyiapkan dokumen cetak seluruh 24 Ruangan...', 'info');

    // Kosongkan container batch print dan render semua ruangan
    batchPrintContainer.innerHTML = '';
    roomsData.forEach((room) => {
      const roomWrapper = document.createElement('div');
      renderCurrentRoom(roomWrapper, room, true);
      batchPrintContainer.appendChild(roomWrapper);
    });

    // Tampilkan batch container, sembunyikan single room
    singleRoomContainer.style.display = 'none';
    batchPrintContainer.style.display = 'block';

    // Berikan jeda render sebelum membuka dialog print browser
    setTimeout(() => {
      window.print();

      // Kembalikan view setelah print
      singleRoomContainer.style.display = 'block';
      batchPrintContainer.style.display = 'none';
      batchPrintContainer.innerHTML = '';
    }, 500);
  }

  // --- EXCEL FILE UPLOADER & PARSER ---
  function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const parsedRooms = parseWorkbook(workbook);

        if (parsedRooms.length === 0) {
          alert('Gagal membaca data dari file Excel. Pastikan sheet berisi format daftar pembagian ruang.');
          return;
        }

        roomsData = parsedRooms;
        currentRoomIndex = 0;
        updateRoomSelectorUI();
        renderCurrentRoom();

        showNotification(`Berhasil memuat ${parsedRooms.length} ruangan dari file: ${file.name}!`, 'success');
      } catch (err) {
        console.error('Error parsing excel:', err);
        alert('Terjadi kesalahan saat memproses file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseWorkbook(workbook) {
    const rooms = [];

    workbook.SheetNames.forEach((sheetName) => {
      if (sheetName === 'ALL' || sheetName.toLowerCase().includes('rekap')) return;

      const ws = workbook.Sheets[sheetName];
      if (!ws) return;

      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rawData.length < 3) return;

      // Baris 0: Nama Kelas (Col A & Col I)
      const row0 = rawData[0] || [];
      const classLeft = (row0[0] || '').toString().trim();
      const classRight = (row0[8] || '').toString().trim();

      let namaRuang = '';
      let noRuang = sheetName;
      const studentsLeft = [];
      const studentsRight = [];

      // Mulai baris 2 (melewati baris header)
      for (let r = 2; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        // Kiri: Col A(0)=No, B(1)=NIS, C(2)=NoTes, D(3)=NoRuang, E(4)=Nama, F(5)=L/P, G(6)=NamaRuang
        const namaL = (row[4] || '').toString().trim();
        if (namaL) {
          namaRuang = (row[6] || '').toString().trim() || namaRuang;
          noRuang = (row[3] || '').toString().trim() || noRuang;
          studentsLeft.push({
            no: (row[0] || '').toString().trim(),
            nis: (row[1] || '').toString().trim(),
            no_tes: (row[2] || '').toString().trim(),
            nama: namaL,
            gender: (row[5] || '').toString().trim(),
            kelas: classLeft
          });
        }

        // Kanan: Col I(8)=No, J(9)=NIS, K(10)=NoTes, L(11)=NoRuang, M(12)=Nama, N(13)=L/P, O(14)=NamaRuang
        const namaR = (row[12] || '').toString().trim();
        if (namaR) {
          namaRuang = (row[14] || '').toString().trim() || namaRuang;
          studentsRight.push({
            no: (row[8] || '').toString().trim(),
            nis: (row[9] || '').toString().trim(),
            no_tes: (row[10] || '').toString().trim(),
            nama: namaR,
            gender: (row[13] || '').toString().trim(),
            kelas: classRight
          });
        }
      }

      if (studentsLeft.length > 0 || studentsRight.length > 0) {
        rooms.push({
          code: sheetName,
          no_ruang: noRuang,
          nama_ruang: namaRuang,
          class_left: classLeft,
          class_right: classRight,
          students_left: studentsLeft,
          students_right: studentsRight,
          total_students: studentsLeft.length + studentsRight.length
        });
      }
    });

    return rooms;
  }

  // Fallback demo data jika tidak ada file
  function generateFallbackData() {
    return [{
      code: 'R 01',
      no_ruang: '01 (Satu)',
      nama_ruang: 'A.2.1',
      class_left: 'X PPLG 1',
      class_right: 'XI TJKT 1',
      students_left: Array.from({ length: 15 }, (_, i) => ({
        no: i + 1,
        nis: `5412610${String(i + 1).padStart(2, '0')}`,
        no_tes: `X PPLG 1 - ${String(i + 1).padStart(2, '0')}`,
        nama: `SISWA KELAS X CONTOH ${i + 1}`,
        gender: i % 2 === 0 ? 'L' : 'P',
        kelas: 'X PPLG 1'
      })),
      students_right: Array.from({ length: 12 }, (_, i) => ({
        no: i + 1,
        nis: `5412510${String(i + 1).padStart(2, '0')}`,
        no_tes: `XI TJKT 1 - ${String(i + 1).padStart(2, '0')}`,
        nama: `SISWA KELAS XI CONTOH ${i + 1}`,
        gender: i % 2 === 0 ? 'L' : 'P',
        kelas: 'XI TJKT 1'
      })),
      total_students: 27
    }];
  }

  // --- UTILS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize upon DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
