/* subtitle-generator — Enhanced Edition */
'use strict';
(function(){
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    if(typeof QU !== 'undefined') QU.init({ kofi: true, discover: true });
    
    let recognition, recording = false, srt = [], index = 1;
    let videoEl = null; // Synced video element
    const rec = $('#recordBtn'), exp = $('#exportBtn'), log = $('#transcriptLog');
    const Sr = window.SpeechRecognition || window.webkitSpeechRecognition;

    // ─── TIMESTAMP FORMATTING ───
    function fTime(ms) {
        if (ms < 0) ms = 0;
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const ms2 = ms % 1000;
        return String(h).padStart(2,'0') + ':' + String(m%60).padStart(2,'0') + ':' + String(s%60).padStart(2,'0') + ',' + String(ms2).padStart(3,'0');
    }
    
    function fTimeVTT(ms) {
        return fTime(ms).replace(',', '.');
    }

    // ─── RENDER TRANSCRIPT ───
    function renderTranscript() {
        log.innerHTML = '';
        srt.forEach((s, i) => {
            const div = document.createElement('div');
            div.className = 'sub-entry';
            div.dataset.idx = i;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="color:#888; font-size:0.75rem;">#${s.id} — ${s.start} → ${s.end}</span>
                    <div style="display:flex; gap:4px;">
                        <button class="sub-edit-btn" data-action="edit" data-idx="${i}" title="Edit">✏️</button>
                        <button class="sub-edit-btn" data-action="split" data-idx="${i}" title="Split at cursor">✂️</button>
                        <button class="sub-edit-btn" data-action="merge" data-idx="${i}" title="Merge with next">🔗</button>
                        <button class="sub-edit-btn" data-action="delete" data-idx="${i}" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="sub-text" contenteditable="false">${s.text}</div>
            `;
            div.style.cssText = 'border-left:3px solid #6366f1; padding:6px 10px; margin:4px 0; border-radius:4px; background:rgba(99,102,241,0.05); cursor:pointer; transition:background 0.15s;';
            div.addEventListener('mouseover', () => div.style.background = 'rgba(99,102,241,0.12)');
            div.addEventListener('mouseout', () => div.style.background = 'rgba(99,102,241,0.05)');
            
            // Click to jump video
            div.addEventListener('click', (e) => {
                if (e.target.closest('.sub-edit-btn')) return;
                if (videoEl) {
                    const parts = s.start.split(/[:,]/);
                    const sec = parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]) + parseInt(parts[3])/1000;
                    videoEl.currentTime = sec;
                }
            });
            
            log.appendChild(div);
        });
        
        // Attach button handlers
        log.querySelectorAll('.sub-edit-btn').forEach(btn => {
            btn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:0.75rem; padding:2px 4px; border-radius:4px;';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                const action = btn.dataset.action;
                handleSubAction(action, idx);
            });
        });
        
        log.scrollTop = log.scrollHeight;
        updateStats();
    }

    // ─── SUBTITLE ACTIONS ───
    function handleSubAction(action, idx) {
        if (action === 'delete') {
            srt.splice(idx, 1);
            reindex();
            renderTranscript();
        } else if (action === 'edit') {
            const entry = log.querySelector(`[data-idx="${idx}"] .sub-text`);
            if (entry) {
                entry.contentEditable = 'true';
                entry.focus();
                entry.style.outline = '1px solid #6366f1';
                entry.style.background = 'rgba(99,102,241,0.1)';
                entry.addEventListener('blur', () => {
                    srt[idx].text = entry.textContent.trim();
                    entry.contentEditable = 'false';
                    entry.style.outline = '';
                    entry.style.background = '';
                }, { once: true });
                entry.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); entry.blur(); }
                });
            }
        } else if (action === 'merge' && idx < srt.length - 1) {
            srt[idx].text += ' ' + srt[idx + 1].text;
            srt[idx].end = srt[idx + 1].end;
            srt.splice(idx + 1, 1);
            reindex();
            renderTranscript();
        } else if (action === 'split') {
            const text = srt[idx].text;
            const mid = Math.floor(text.length / 2);
            const space = text.indexOf(' ', mid);
            const splitAt = space > -1 ? space : mid;
            
            // Parse start/end times to ms
            const startMs = parseTimeToMs(srt[idx].start);
            const endMs = parseTimeToMs(srt[idx].end);
            const midMs = Math.floor((startMs + endMs) / 2);
            
            const newEntry = {
                id: 0, // Will reindex
                start: fTime(midMs),
                end: srt[idx].end,
                text: text.substring(splitAt).trim()
            };
            srt[idx].text = text.substring(0, splitAt).trim();
            srt[idx].end = fTime(midMs);
            srt.splice(idx + 1, 0, newEntry);
            reindex();
            renderTranscript();
        }
    }

    function parseTimeToMs(timeStr) {
        const parts = timeStr.split(/[:,]/);
        return parseInt(parts[0])*3600000 + parseInt(parts[1])*60000 + parseInt(parts[2])*1000 + parseInt(parts[3]);
    }

    function reindex() {
        srt.forEach((s, i) => s.id = i + 1);
        index = srt.length + 1;
    }

    // ─── STATISTICS ───
    function updateStats() {
        const stats = $('#subStats');
        if (!stats) return;
        const totalChars = srt.reduce((a, s) => a + s.text.length, 0);
        const totalWords = srt.reduce((a, s) => a + s.text.split(/\s+/).filter(Boolean).length, 0);
        const totalDur = srt.length > 0 ? parseTimeToMs(srt[srt.length-1].end) : 0;
        stats.innerHTML = `<span>📝 ${srt.length} subtitles</span> · <span>💬 ${totalWords} words</span> · <span>📊 ${totalChars} chars</span> · <span>⏱️ ${fTime(totalDur)}</span>`;
    }

    // ─── SPEECH RECOGNITION ───
    if (Sr) {
        recognition = new Sr();
        recognition.continuous = true;
        recognition.interimResults = true;
        let startTime;

        recognition.onstart = () => {
            startTime = Date.now();
            recording = true;
            rec.textContent = '🛑 Stop Recording';
            rec.style.background = '#ef4444';
            rec.classList.add('recording');
        };

        recognition.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                    const text = e.results[i][0].transcript.trim();
                    const confidence = e.results[i][0].confidence;
                    const end = Date.now() - startTime;
                    const start = Math.max(0, end - 2000);
                    srt.push({
                        id: index++,
                        start: fTime(start),
                        end: fTime(end),
                        text,
                        confidence: Math.round(confidence * 100)
                    });
                    renderTranscript();
                }
            }
            // Show interim results
            const interim = $('#interimText');
            if (interim) {
                let interimText = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    if (!e.results[i].isFinal) {
                        interimText += e.results[i][0].transcript;
                    }
                }
                interim.textContent = interimText;
                interim.style.opacity = interimText ? '1' : '0';
            }
        };

        recognition.onerror = (e) => {
            console.log(e);
            if (e.error !== 'no-speech') {
                log.innerHTML += `<div style="color:#ef4444; padding:4px 8px; margin:4px 0;">⚠️ Error: ${e.error}</div>`;
            }
        };

        recognition.onend = () => {
            recording = false;
            rec.textContent = '🎙️ Start Recording';
            rec.style.background = '';
            rec.classList.remove('recording');
            const interim = $('#interimText');
            if (interim) interim.textContent = '';
        };

        rec.onclick = () => {
            recognition.lang = $('#langRec').value;
            recording ? recognition.stop() : recognition.start();
        };
    } else {
        log.innerHTML = '<div style="color:#ef4444; padding:1rem;">Speech recognition is not supported in this browser. Please use Chrome or Edge.</div>';
    }

    // ─── EXPORT FORMATS ───
    function exportSRT() {
        if (srt.length === 0) return alert('No subtitles to export');
        let content = srt.map(s => s.id + '\n' + s.start + ' --> ' + s.end + '\n' + s.text + '\n').join('\n');
        download(content, 'subtitles.srt', 'text/plain');
    }

    function exportVTT() {
        if (srt.length === 0) return alert('No subtitles to export');
        let content = 'WEBVTT\n\n';
        content += srt.map(s => s.id + '\n' + fTimeVTT(parseTimeToMs(s.start)) + ' --> ' + fTimeVTT(parseTimeToMs(s.end)) + '\n' + s.text + '\n').join('\n');
        download(content, 'subtitles.vtt', 'text/vtt');
    }

    function exportASS() {
        if (srt.length === 0) return alert('No subtitles to export');
        let content = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
        content += srt.map(s => {
            const start = s.start.replace(',', '.').replace(/^0/, '');
            const end = s.end.replace(',', '.').replace(/^0/, '');
            return `Dialogue: 0,${start},${end},Default,,0,0,0,,${s.text}`;
        }).join('\n');
        download(content, 'subtitles.ass', 'text/plain');
    }

    function exportJSON() {
        if (srt.length === 0) return alert('No subtitles to export');
        download(JSON.stringify(srt, null, 2), 'subtitles.json', 'application/json');
    }

    function exportTXT() {
        if (srt.length === 0) return alert('No subtitles to export');
        download(srt.map(s => s.text).join('\n'), 'transcript.txt', 'text/plain');
    }

    function download(content, filename, mime) {
        const blob = new Blob([content], { type: mime + ';charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // ─── IMPORT SRT ───
    function importSRT(text) {
        const blocks = text.trim().split(/\n\n+/);
        srt = [];
        index = 1;
        blocks.forEach(block => {
            const lines = block.split('\n');
            if (lines.length >= 3) {
                const id = parseInt(lines[0]);
                const times = lines[1].split(' --> ');
                if (times.length === 2) {
                    srt.push({
                        id: id || index,
                        start: times[0].trim(),
                        end: times[1].trim(),
                        text: lines.slice(2).join(' ').trim()
                    });
                    index = (id || index) + 1;
                }
            }
        });
        renderTranscript();
    }

    // ─── VIDEO SYNC ───
    function loadVideo(file) {
        if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.controls = true;
            videoEl.style.cssText = 'width:100%; max-height:400px; border-radius:8px; margin-top:1rem;';
            const container = $('#videoContainer');
            if (container) container.appendChild(videoEl);
        }
        videoEl.src = URL.createObjectURL(file);
        videoEl.load();
    }

    // ─── EVENT BINDINGS ───
    // Export dropdown
    if (exp) {
        exp.onclick = exportSRT; // default
    }
    
    const exportVTTBtn = $('#exportVTTBtn');
    const exportASSBtn = $('#exportASSBtn');
    const exportJSONBtn = $('#exportJSONBtn');
    const exportTXTBtn = $('#exportTXTBtn');
    
    if (exportVTTBtn) exportVTTBtn.onclick = exportVTT;
    if (exportASSBtn) exportASSBtn.onclick = exportASS;
    if (exportJSONBtn) exportJSONBtn.onclick = exportJSON;
    if (exportTXTBtn) exportTXTBtn.onclick = exportTXT;

    // Import
    const importBtn = $('#importBtn');
    if (importBtn) {
        importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.srt,.txt';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => importSRT(ev.target.result);
                reader.readAsText(file);
            };
            input.click();
        };
    }

    // Video upload
    const videoBtn = $('#videoUpload');
    if (videoBtn) {
        videoBtn.onchange = (e) => {
            if (e.target.files[0]) loadVideo(e.target.files[0]);
        };
    }

    // Clear
    const clearBtn = $('#clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            srt = [];
            index = 1;
            log.innerHTML = '';
            updateStats();
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            exportSRT();
        }
        if (e.ctrlKey && e.key === 'r' && !e.shiftKey) {
            e.preventDefault();
            rec.click();
        }
    });

    // Export for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { fTime, fTimeVTT, parseTimeToMs, importSRT };
    }
})();
