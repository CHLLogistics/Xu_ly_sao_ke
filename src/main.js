import { APP_DATA } from './data.js';
import { 
    loadAllMasterData, 
    addMappingRule, deleteMappingRule, updateMappingRule,
    addAccountingRule, deleteAccountingRule, updateAccountingRule,
    addEntity, deleteEntity, updateEntity,
    addMasterAccount, deleteMasterAccount, updateMasterAccount,
    addSpecialRule, deleteSpecialRule
} from './services/masterDataService.js';
import { applyRuleEngine } from './engine/ruleEngine.js';
import { applyEntityMapping } from './engine/entityMapper.js';
import { BankParsers } from './services/bankParserService.js';
import { exportAmis } from './ui/exportAmis.js';

// DOM Elements
const $ = id => document.getElementById(id);
const dropZone = $('drop-zone'), fileInput = $('file-input');
const views = [$('view-upload'), $('view-results'), $('view-export'), $('view-admin')];
const resultsBody = $('results-body'), bankNameEl = $('bank-name'), recordCountEl = $('record-count');
const steps = [$('step-1'), $('step-2'), $('step-3'), $('step-4')];
const stepLines = document.querySelectorAll('.step-line');

let processedData = [], currentBankInfo = null, currentBankId = null;
let localAppData = null;
let historyStack = [];

function safeSaveSession() {
    try {
        localStorage.setItem('bankSessionData', JSON.stringify({ processedData, currentBankId, currentBankInfo }));
    } catch (e) {
        console.warn("Storage Quota Exceeded. Not saving session.", e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
             showToast('Cảnh báo: Dữ liệu quá lớn, không thể lưu phiên dự phòng (F5 sẽ mất)', true);
        }
    }
}

function saveHistory(actionObj) {
    if (historyStack.length >= 20) historyStack.shift();
    historyStack.push(actionObj);
    updateUndoButton();
}

function updateUndoButton() {
    const undoBtn = $('btn-global-back');
    if (undoBtn) {
        if (historyStack.length > 0) {
            undoBtn.style.display = 'flex';
            undoBtn.onclick = undoAction;
        } else {
            undoBtn.style.display = 'none';
        }
    }
}

function undoAction() {
    if (historyStack.length > 0) {
        let lastAction = historyStack.pop();
        if (lastAction.action === 'delete') {
            processedData.splice(lastAction.index, 0, lastAction.item);
        } else if (lastAction.action === 'edit') {
            lastAction.changes.forEach(c => {
                processedData[c.index].entityCode = c.oldCode;
                processedData[c.index].entityName = c.oldName;
                processedData[c.index].descRule = c.oldDescRule;
            });
        }
        safeSaveSession();
        renderResults();
        updateUndoButton();
        showToast('Đã khôi phục (Undo) thao tác vừa rồi');
    }
}

// Recover session & load data
window.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    const statusBadge = $('supabase-status-badge');
    try {
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            localAppData = await loadAllMasterData();
            console.log("Loaded master data from Supabase successfully.");
            if (statusBadge) {
                statusBadge.textContent = "Supabase Connected";
                statusBadge.style.background = "rgba(16, 185, 129, 0.15)";
                statusBadge.style.color = "var(--success)";
            }
        } else {
            console.log("Supabase credentials not found. Falling back to data.js.");
            localAppData = JSON.parse(localStorage.getItem('bankMasterData')) || APP_DATA;
            if (statusBadge) {
                statusBadge.textContent = "Local Storage Fallback";
                statusBadge.style.background = "rgba(249, 115, 22, 0.15)";
                statusBadge.style.color = "var(--primary)";
            }
        }
    } catch (e) {
        console.error("Failed to fetch from Supabase. Falling back to Local Storage/data.js.", e);
        localAppData = JSON.parse(localStorage.getItem('bankMasterData')) || APP_DATA;
        if (statusBadge) {
            statusBadge.textContent = "Offline Mode";
            statusBadge.style.background = "rgba(239, 68, 68, 0.15)";
            statusBadge.style.color = "var(--danger)";
        }
    } finally {
        hideLoading();
    }

    let s = localStorage.getItem('bankSessionData');
    if (s) {
        try {
            let session = JSON.parse(s);
            if (session.processedData && session.processedData.length > 0) {
                processedData = session.processedData;
                currentBankId = session.currentBankId;
                currentBankInfo = session.currentBankInfo;
                if (currentBankInfo) {
                    bankNameEl.textContent = `Ngân hàng: ${currentBankInfo.bank} - ${currentBankInfo.description}`;
                    renderResults();
                    showView(views[1], 3);
                    showToast('Đã khôi phục phiên làm việc trước');
                }
            }
        } catch (e) { }
    }
});

// Event Listeners
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

const resetApp = () => {
    processedData = []; currentBankInfo = null; currentBankId = null;
    historyStack = [];
    updateUndoButton();
    localStorage.removeItem('bankSessionData');
    showView(views[0], 1);
};
$('btn-reset').addEventListener('click', resetApp);
$('btn-start-over').addEventListener('click', resetApp);
if($('btn-back-results')) $('btn-back-results').addEventListener('click', () => showView(views[1], 3));

$('btn-export').addEventListener('click', () => {
    let checkAgainCount = processedData.filter(d => d.entityCode === 'CHECK_AGAIN').length;
    if (checkAgainCount > 0) {
        let confirmExport = confirm(`⚠️ CẢNH BÁO: Hiện tại vẫn còn ${checkAgainCount} giao dịch chưa được Map mã đối tượng (CHECK_AGAIN).\n\nNếu bạn tiếp tục xuất file, các dòng này sẽ bị ĐỂ TRỐNG mã đối tượng trên file Excel trả về.\nBạn có chắc chắn muốn bỏ qua lỗi và xuất file không?`);
        if (!confirmExport) return;
    }
    showView(views[2], 4);
});
$('btn-export-thu').addEventListener('click', () => exportAmis('THU', processedData, currentBankInfo, currentBankId, localAppData, showToast));
$('btn-export-chi').addEventListener('click', () => exportAmis('CHI', processedData, currentBankInfo, currentBankId, localAppData, showToast));

// Settings Modal Listeners
if ($('btn-settings')) {
    $('btn-settings').addEventListener('click', () => {
        $('settings-modal').classList.add('show');
        const isSupabase = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
        $('master-data-stats').textContent = isSupabase
            ? 'Trạng thái: Đang kết nối trực tiếp Supabase Cloud Database'
            : (localStorage.getItem('bankMasterData')
                ? 'Trạng thái: Đang dùng cấu hình Custom (Local Storage)'
                : 'Trạng thái: Đang dùng default data.js');
    });
}
$('btn-close-settings').addEventListener('click', () => $('settings-modal').classList.remove('show'));
$('btn-clear-settings').addEventListener('click', () => {
    localStorage.removeItem('bankMasterData');
    localAppData = APP_DATA;
    $('master-data-stats').textContent = 'Trạng thái: Đang dùng default data.js';
    showToast('Đã khôi phục Master Data mặc định');
});

$('btn-export-master').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    const wsDM = XLSX.utils.json_to_sheet(localAppData.DM_DOI_TUONG.map(r => ({'Từ khóa': r.keyword, 'Mã đối tượng': r.code})));
    XLSX.utils.book_append_sheet(wb, wsDM, "DM_DOI_TUONG");
    
    const entitiesArr = Object.keys(localAppData.ENTITIES).map(k => ({
        "Mã đối tượng": k,
        "Tên đối tượng": localAppData.ENTITIES[k]
    }));
    const wsKH = XLSX.utils.json_to_sheet(entitiesArr);
    XLSX.utils.book_append_sheet(wb, wsKH, "KH");
    
    if (localAppData.ACCOUNTING_RULES) {
        const wsRules = XLSX.utils.json_to_sheet(localAppData.ACCOUNTING_RULES.map(r => ({
            'Từ khóa': r.keyword,
            'Loại phiếu': r.isThu ? 'THU' : 'CHI',
            'TK Nợ': r.tkNo,
            'TK Có': r.tkCo
        })));
        XLSX.utils.book_append_sheet(wb, wsRules, "ACCOUNTING_RULES");
    }
    
    if (localAppData.SPECIAL_RULES) {
        const wsSpecialRules = XLSX.utils.json_to_sheet(localAppData.SPECIAL_RULES.map(r => ({
            'Điều kiện (&& để nối)': r.condition,
            'Cắt từ chữ': r.cutFrom,
            'Đến chữ': r.cutTo,
            'Định dạng xuất': r.format
        })));
        XLSX.utils.book_append_sheet(wb, wsSpecialRules, "SPECIAL_RULES");
    }
    
    XLSX.writeFile(wb, "TEMPLATE_MASTER_DATA.xlsx");
    showToast('Đã tải xuống file cấu hình Master Data');
});

// Master Data Upload
$('master-file-input').addEventListener('change', e => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    showLoading();
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                let newAppData = { ...localAppData };

                if (workbook.Sheets['DM_DOI_TUONG']) {
                    const dm = XLSX.utils.sheet_to_json(workbook.Sheets['DM_DOI_TUONG']);
                    if (dm.length > 0) {
                        newAppData.DM_DOI_TUONG = dm.map(d => ({
                            keyword: d.keyword || d['TừKhóa'] || d['Từ khóa'] || Object.values(d)[0],
                            code: d.code || d['Mã Đối Tượng'] || d['Mã đối tượng'] || Object.values(d)[1]
                        })).filter(d => d.keyword && d.code);
                    }
                }
                newAppData.ENTITIES = { ...newAppData.ENTITIES };
                ['KH', 'NCC'].forEach(sheetName => {
                    if (workbook.Sheets[sheetName]) {
                        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                        rows.forEach(r => {
                            let code = r['Mã KH'] || r['Mã NCC'] || r['Mã đối tượng'];
                            let name = r['Tên KH'] || r['Tên NCC'] || r['Tên đối tượng'] || r['Tên'];
                            if (code && name) newAppData.ENTITIES[code] = name;
                        });
                    }
                });

                if (workbook.Sheets['ACCOUNTING_RULES']) {
                    const rules = XLSX.utils.sheet_to_json(workbook.Sheets['ACCOUNTING_RULES']);
                    if (rules.length > 0) {
                        newAppData.ACCOUNTING_RULES = rules.map(r => ({
                            keyword: r['Từ khóa'] || r.keyword || Object.values(r)[0],
                            isThu: ((r['Loại phiếu'] || r['Loại'] || '').toUpperCase() === 'THU'),
                            tkNo: r['TK Nợ'] || r.tkNo,
                            tkCo: r['TK Có'] || r.tkCo
                        }));
                    }
                }
                
                if (workbook.Sheets['SPECIAL_RULES']) {
                    const sr = XLSX.utils.sheet_to_json(workbook.Sheets['SPECIAL_RULES']);
                    if (sr.length > 0) {
                        newAppData.SPECIAL_RULES = sr.map(r => ({
                            condition: r['Điều kiện (&& để nối)'] || r.condition || '',
                            cutFrom: r['Cắt từ chữ'] || r.cutFrom || '',
                            cutTo: r['Đến chữ'] || r.cutTo || '',
                            format: r['Định dạng xuất'] || r.format || ''
                        }));
                    }
                }

                localAppData = newAppData;
                localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
                $('master-data-stats').innerHTML = 'Trạng thái: <span style="color:var(--success);font-weight:bold;">ĐÃ XỬ LÝ THÀNH CÔNG</span> (Custom Data)';
                showToast('ĐÃ XỬ LÝ THÀNH CÔNG', false);
            } catch (err) {
                console.error(err);
                $('master-data-stats').innerHTML = 'Trạng thái: <span style="color:var(--danger);font-weight:bold;">KHÔNG THÀNH CÔNG</span> (Lỗi cấu hình)';
                showToast('KHÔNG THÀNH CÔNG', true);
            } finally {
                hideLoading();
            }
        };
        reader.onerror = () => { 
            hideLoading(); 
            $('master-data-stats').innerHTML = 'Trạng thái: <span style="color:var(--danger);font-weight:bold;">KHÔNG THÀNH CÔNG</span> (Lỗi đọc file)';
            showToast('KHÔNG THÀNH CÔNG', true); 
        };
        reader.readAsArrayBuffer(file);
    }, 50);
});

// Utility Functions
function showLoading() {
    const loader = $('loading-overlay');
    if(loader) loader.classList.add('active');
}
function hideLoading() {
    const loader = $('loading-overlay');
    if(loader) loader.classList.remove('active');
}

function showToast(msg, isError = false) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.style.borderLeft = `4px solid ${isError ? 'var(--danger)' : 'var(--success)'}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showView(viewEl, stepIndex) {
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = (v === viewEl) ? 'block' : 'none';
    });
    viewEl.classList.add('active');
    steps.forEach((s, idx) => {
        s.classList.toggle('completed', idx < stepIndex);
        s.classList.toggle('active', idx === stepIndex - 1);
    });
    stepLines.forEach((l, idx) => l.classList.toggle('active', idx < stepIndex - 1));
}

const formatMoney = amt => !amt ? '0' : Number(amt).toLocaleString('en-US');

function handleFile(file) {
    showLoading();
    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false });
                processData(jsonData);
            } catch (err) {
                console.error(err);
                showToast('KHÔNG THÀNH CÔNG', true);
            } finally {
                hideLoading();
            }
        };
        reader.onerror = () => { hideLoading(); showToast('KHÔNG THÀNH CÔNG', true); };
        reader.readAsArrayBuffer(file);
    }, 50);
}

function processData(rows) {
    let matchedParserName = null, parserContext = null;

    for (const [parserName, parser] of Object.entries(BankParsers)) {
        const detection = parser.detect(rows, localAppData);
        if (detection) {
            matchedParserName = parserName;
            parserContext = detection;
            break;
        }
    }

    if (!matchedParserName) return showToast('KHÔNG THÀNH CÔNG (Định dạng lạ)', true);

    currentBankId = parserContext.bankId;
    currentBankInfo = localAppData.MASTER[currentBankId];
    bankNameEl.textContent = `Ngân hàng: ${currentBankInfo.bank} - ${currentBankInfo.description}`;
    processedData = [];
    historyStack = [];
    updateUndoButton();

    const parser = BankParsers[matchedParserName];

    for (let i = parserContext.startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.length) continue;

        const pData = parser.parseRow(row, parserContext);
        if (!pData || (!pData.descRaw || (pData.debit === 0 && pData.credit === 0))) continue;

        const ruleResult = applyRuleEngine(pData.descRaw);
        const mappingResult = applyEntityMapping(pData.descRaw, localAppData.DM_DOI_TUONG);

        let finalDescRule = mappingResult.code !== "CHECK_AGAIN" ? mappingResult.keyword : ruleResult;

        if (mappingResult.code !== "CHECK_AGAIN" && localAppData.SPECIAL_RULES && localAppData.SPECIAL_RULES.length > 0) {
            for (let r of localAppData.SPECIAL_RULES) {
                if (!r.condition) continue;
                let conditions = r.condition.split('&&').map(c => c.trim()).filter(c => c);
                let isMatch = conditions.length > 0 && conditions.every(c => pData.descRaw.includes(c));
                
                if (isMatch) {
                    let extractedMatch = "";
                    if (r.cutFrom || r.cutTo) {
                        let cf = r.cutFrom ? r.cutFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
                        let ct = r.cutTo ? r.cutTo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
                        let pattern = cf + "(.*?)" + ct;
                        let regexMatch = pData.descRaw.match(new RegExp(pattern, "i"));
                        if (regexMatch && regexMatch[1]) {
                            extractedMatch = regexMatch[1].trim();
                        }
                    }
                    let entityName = localAppData.ENTITIES[mappingResult.code] || mappingResult.code;
                    let resultText = (r.format || "{KEYWORD} - {MATCH}");
                    resultText = resultText.replace("{KEYWORD}", mappingResult.keyword);
                    resultText = resultText.replace("{NAME}", entityName);
                    resultText = resultText.replace("{MATCH}", extractedMatch);
                    
                    finalDescRule = resultText;
                    break;
                }
            }
        }

        processedData.push({
            date: pData.date,
            debit: pData.debit,
            credit: pData.credit,
            descRaw: pData.descRaw,
            descRule: finalDescRule,
            entityCode: mappingResult.code,
            entityName: localAppData.ENTITIES[mappingResult.code] || ''
        });
    }

    safeSaveSession();
    renderResults();
    showView(views[1], 3);
    showToast(`ĐÃ XỬ LÝ THÀNH CÔNG (${processedData.length} giao dịch)`);
}

// Inline Edit Logic
let editingItemIndex = null;
window.openInlineEdit = function (index) {
    editingItemIndex = index;
    let item = processedData[index];
    if($('edit-desc-rule')) $('edit-desc-rule').value = item.descRule;
    $('edit-entity-code').value = item.entityCode !== 'CHECK_AGAIN' ? item.entityCode : '';
    $('inline-edit-modal').classList.add('show');
    $('edit-entity-code').focus();
};

window.toggleActionMenu = function(e, index) {
    e.stopPropagation();
    let currentMenu = document.getElementById(`action-menu-${index}`);
    let isShowing = currentMenu ? currentMenu.classList.contains('show') : false;
    
    document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
    if (!isShowing && currentMenu) currentMenu.classList.add('show');
};

window.addEventListener('click', () => {
    document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
});

window.deleteItem = function(index) {
    if(confirm('Bạn có chắc chắn muốn xóa giao dịch này? Dòng bị xóa sẽ không được xuất sang file Excel nữa.')) {
        saveHistory({ action: 'delete', index: index, item: { ...processedData[index] } });
        processedData.splice(index, 1);
        safeSaveSession();
        renderResults();
        showToast('Đã xóa dòng giao dịch');
    }
};

$('btn-cancel-edit').addEventListener('click', () => $('inline-edit-modal').classList.remove('show'));
$('btn-save-edit').addEventListener('click', async () => {
    let newCode = $('edit-entity-code').value.trim();
    let newDesc = $('edit-desc-rule') ? $('edit-desc-rule').value.trim() : '';
    if (!newCode) newCode = "CHECK_AGAIN";
    if (!newDesc) return showToast('Diễn giải không được để trống', true);

    const oldDesc = processedData[editingItemIndex].descRule;
    
    // Ghi nhận Patch lịch sử thay đổi (Chỉ lưu các dòng thực tế bị sửa)
    let historyChanges = [];
    historyChanges.push({
        index: editingItemIndex,
        oldCode: processedData[editingItemIndex].entityCode,
        oldName: processedData[editingItemIndex].entityName,
        oldDescRule: processedData[editingItemIndex].descRule
    });

    processedData[editingItemIndex].entityCode = newCode;
    processedData[editingItemIndex].entityName = newCode !== "CHECK_AGAIN" ? (localAppData.ENTITIES[newCode] || '') : '';
    processedData[editingItemIndex].descRule = newDesc;

    let updateCount = 0;
    
    // Thuật toán quét hồi tố an toàn (Word Boundary Strict)
    let escapedKw = newDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let safeDescRegex = new RegExp('(^|[^a-zA-Z0-9_À-ỹ])' + escapedKw + '([^a-zA-Z0-9_À-ỹ]|$)', 'i');

    processedData.forEach((row, i) => {
        if (i !== editingItemIndex) {
            let matchNewKeyword = newDesc && safeDescRegex.test(row.descRaw);
            let matchOldRule = oldDesc && row.descRule.toUpperCase() === oldDesc.toUpperCase();
            
            if (matchNewKeyword || matchOldRule) {
                historyChanges.push({ index: i, oldCode: row.entityCode, oldName: row.entityName, oldDescRule: row.descRule });
                row.entityCode = newCode;
                row.entityName = newCode !== "CHECK_AGAIN" ? (localAppData.ENTITIES[newCode] || '') : '';
                row.descRule = newDesc;
                updateCount++;
            }
        }
    });

    saveHistory({ action: 'edit', changes: historyChanges });

    if ($('edit-save-rule').checked && newCode !== "CHECK_AGAIN") {
        let exists = localAppData.DM_DOI_TUONG.find(r => r.keyword.toUpperCase() === newDesc.toUpperCase());
        if (!exists) {
            localAppData.DM_DOI_TUONG.push({ keyword: newDesc, code: newCode });
            
            // Sync to Supabase if config exists
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                try {
                    await addMappingRule(newDesc, newCode);
                    showToast('Đã tạo Rule Map mới trên Supabase Cloud');
                } catch (err) {
                    console.error("Failed to sync new rule to Supabase:", err);
                    showToast('Lỗi đồng bộ Rule lên Supabase', true);
                }
            } else {
                localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
                showToast('Đã tạo Rule Map mới (Local Storage)');
            }
        }
    }

    if (updateCount > 0) {
        setTimeout(() => showToast(`Đã tự đồng bộ thêm ${updateCount} dòng giống nhau`), 500);
    }

    safeSaveSession();
    $('inline-edit-modal').classList.remove('show');
    renderResults();
});

$('filter-text').addEventListener('input', renderResults);
$('filter-status').addEventListener('change', renderResults);
document.querySelectorAll('.col-filter').forEach(el => el.addEventListener('input', renderResults));

if ($('btn-clear-filters')) {
    $('btn-clear-filters').addEventListener('click', () => {
        if ($('filter-text')) $('filter-text').value = '';
        if ($('filter-status')) $('filter-status').value = 'ALL';
        document.querySelectorAll('.col-filter').forEach(el => el.value = '');
        renderResults();
    });
}

function renderResults() {
    resultsBody.innerHTML = '';
    
    let filterText = $('filter-text') ? $('filter-text').value.toLowerCase().trim() : '';
    let filterStatus = $('filter-status') ? $('filter-status').value : 'ALL';
    
    let colDate = $('col-filter-date') ? $('col-filter-date').value.toLowerCase().trim() : '';
    let colDebit = $('col-filter-debit') ? $('col-filter-debit').value.toLowerCase().trim() : '';
    let colCredit = $('col-filter-credit') ? $('col-filter-credit').value.toLowerCase().trim() : '';
    let colDescRaw = $('col-filter-descRaw') ? $('col-filter-descRaw').value.toLowerCase().trim() : '';
    let colDescRule = $('col-filter-descRule') ? $('col-filter-descRule').value.toLowerCase().trim() : '';
    let colEntity = $('col-filter-entity') ? $('col-filter-entity').value.toLowerCase().trim() : '';

    let displayData = processedData.filter(item => {
        let matchText = filterText === '' || `${item.descRaw} ${item.descRule} ${item.entityCode} ${item.entityName}`.toLowerCase().includes(filterText);
        let matchStatus = filterStatus === 'ALL' || 
                         (filterStatus === 'CHECK_AGAIN' ? item.entityCode === 'CHECK_AGAIN' : item.entityCode !== 'CHECK_AGAIN');
                          
        let matchColDate = colDate === '' || item.date.toLowerCase().includes(colDate);
        let matchColDebit = colDebit === '' || formatMoney(item.debit).includes(colDebit) || item.debit.toString().includes(colDebit);
        let matchColCredit = colCredit === '' || formatMoney(item.credit).includes(colCredit) || item.credit.toString().includes(colCredit);
        let matchColDescRaw = colDescRaw === '' || item.descRaw.toLowerCase().includes(colDescRaw);
        let matchColDescRule = colDescRule === '' || item.descRule.toLowerCase().includes(colDescRule);
        let matchColEntity = colEntity === '' || (item.entityCode !== 'CHECK_AGAIN' && item.entityCode.toLowerCase().includes(colEntity)) || (item.entityName && item.entityName.toLowerCase().includes(colEntity)) || (colEntity==='check_again' && item.entityCode === 'CHECK_AGAIN');

        return matchText && matchStatus && matchColDate && matchColDebit && matchColCredit && matchColDescRaw && matchColDescRule && matchColEntity;
    });

    recordCountEl.innerHTML = `Hiển thị <strong>${displayData.length}</strong> / Tổng ${processedData.length} giao dịch`;

    displayData.forEach((item) => {
        let originalIndex = processedData.indexOf(item);
        const tr = document.createElement('tr');
        let badge = item.entityCode === 'CHECK_AGAIN'
            ? `<span class="badge-check edit-mapping" onclick="openInlineEdit(${originalIndex})" title="Nhấp để sửa">⚠️ ${item.entityCode}</span>`
            : `<span class="badge-mapped edit-mapping" onclick="openInlineEdit(${originalIndex})" title="Nhấp để sửa">${item.entityCode}</span>`;

        tr.innerHTML = `
            <td>${item.date}</td>
            <td class="text-right" style="color:var(--danger)">${formatMoney(item.debit)}</td>
            <td class="text-right" style="color:var(--success)">${formatMoney(item.credit)}</td>
            <td style="min-width: 250px; word-wrap: break-word; white-space: normal;">${item.descRaw}</td>
            <td style="min-width: 250px; word-wrap: break-word; white-space: normal;">
                <strong class="edit-mapping" onclick="openInlineEdit(${originalIndex})" title="Nhấp để sửa Diễn giải" style="cursor:pointer;">${item.descRule}</strong>
            </td>
            <td>${badge}</td>
            <td class="row-actions">
                <button class="btn-dots" onclick="toggleActionMenu(event, ${originalIndex})">⋮</button>
                <div class="action-menu" id="action-menu-${originalIndex}">
                    <button onclick="openInlineEdit(${originalIndex}); toggleActionMenu(event, ${originalIndex})">✏ Cập nhật Đối tượng</button>
                    <button class="text-danger" onclick="deleteItem(${originalIndex})">🗑 Xóa dòng này</button>
                </div>
            </td>
        `;
        resultsBody.appendChild(tr);
    });
}

// ==========================================
// === ADMIN CATEGORIES MANAGEMENT ROUTER ===
// ==========================================
let currentAdminTab = 'entities';
let adminPagination = {
    entities: { page: 1, search: '', limit: 10 },
    mapping: { page: 1, search: '', limit: 10 },
    accounts: { search: '' },
    rules: { search: '' },
    special: { search: '' }
};
let lastMainView = views[0];

function openAdminPanel() {
    // Save last active main view
    const activeView = views.find(v => v.classList.contains('active') && v.id !== 'view-admin');
    if (activeView) lastMainView = activeView;

    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = (v.id === 'view-admin') ? 'block' : 'none';
    });
    $('view-admin').classList.add('active');

    // Setup sidebar button states
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === currentAdminTab);
    });

    renderAdminTab();
}

function closeAdminPanel() {
    $('view-admin').classList.remove('active');
    $('view-admin').style.display = 'none';
    
    views.forEach(v => {
        if (v === lastMainView) {
            v.classList.add('active');
            v.style.display = 'block';
        } else {
            v.style.display = 'none';
        }
    });

    // Sync stepper header
    const stepIndex = views.indexOf(lastMainView) + 1;
    steps.forEach((s, idx) => {
        s.classList.toggle('completed', idx < stepIndex);
        s.classList.toggle('active', idx === stepIndex - 1);
    });
    stepLines.forEach((l, idx) => l.classList.toggle('active', idx < stepIndex - 1));
}

$('btn-admin-panel').addEventListener('click', openAdminPanel);
$('btn-back-from-admin').addEventListener('click', closeAdminPanel);

document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAdminTab = btn.dataset.tab;
        renderAdminTab();
    });
});

function renderAdminTab() {
    const container = $('admin-panel-container');
    if (!container) return;
    container.innerHTML = '';

    if (currentAdminTab === 'entities') {
        renderEntitiesPanel(container);
    } else if (currentAdminTab === 'mapping') {
        renderMappingPanel(container);
    } else if (currentAdminTab === 'accounts') {
        renderAccountsPanel(container);
    } else if (currentAdminTab === 'rules') {
        renderRulesPanel(container);
    } else if (currentAdminTab === 'special') {
        renderSpecialRulesPanel(container);
    }
}

// 1. Entities Management Panel
function renderEntitiesPanel(container) {
    const state = adminPagination.entities;
    const all = Object.keys(localAppData.ENTITIES).map(code => ({ code, name: localAppData.ENTITIES[code] }));
    const filtered = all.filter(item => {
        const s = state.search.toLowerCase();
        return !s || item.code.toLowerCase().includes(s) || item.name.toLowerCase().includes(s);
    });
    filtered.sort((a, b) => a.code.localeCompare(b.code));

    const total = filtered.length;
    const pages = Math.ceil(total / state.limit) || 1;
    const page = Math.min(state.page, pages);
    state.page = page;
    const start = (page - 1) * state.limit;
    const paginated = filtered.slice(start, start + state.limit);

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0; font-size:1.4rem;">👥 Danh mục Khách hàng & Nhà cung cấp</h2>
        </div>
        <div class="admin-search-bar">
            <input type="text" id="admin-search-entities" class="form-control" placeholder="Tìm theo mã hoặc tên đối tượng..." value="${state.search}">
            ${state.search ? '<button class="btn btn-secondary" id="btn-admin-search-entities-clear">✖</button>' : ''}
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Mã Đối Tượng (*)</label>
                <input type="text" id="admin-add-entity-code" class="form-control" placeholder="VD: BGD002">
            </div>
            <div class="form-group" style="flex:2;">
                <label>Tên Đối Tượng / Tên Công Ty (*)</label>
                <input type="text" id="admin-add-entity-name" class="form-control" placeholder="VD: Ong Nguyen Van A">
            </div>
            <button class="btn btn-primary" id="btn-admin-add-entity" style="padding:10px 20px;">➕ Thêm</button>
        </div>
        <div class="table-container glass-panel" style="flex:1; overflow-y:auto; max-height:480px;">
            <table style="width:100%;">
                <thead>
                    <tr>
                        <th style="width:150px;">Mã Đối Tượng</th>
                        <th>Tên Đối Tượng</th>
                        <th style="width:140px; text-align:center;">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginated.map(item => `
                        <tr>
                            <td style="font-weight:600;">${item.code}</td>
                            <td>${item.name}</td>
                            <td style="text-align:center; display:flex; gap:6px; justify-content:center;">
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.85em;" onclick="editAdminEntity('${item.code}', '${item.name.replace(/'/g, "\\'")}')">✏ Sửa</button>
                                <button class="btn btn-secondary text-danger" style="padding:4px 8px; font-size:0.85em;" onclick="deleteAdminEntity('${item.code}')">🗑 Xóa</button>
                            </td>
                        </tr>
                    `).join('')}
                    ${paginated.length === 0 ? '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Không tìm thấy đối tượng phù hợp.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
        <div class="pagination-container">
            <div style="font-size:0.9em; color:var(--text-muted);">Hiển thị ${total ? start + 1 : 0} - ${Math.min(start + paginated.length, total)} / Tổng số ${total} đối tượng</div>
            <div class="pagination-buttons">
                <button class="btn btn-secondary" id="btn-entity-prev" ${page <= 1 ? 'disabled' : ''}>◀ Trước</button>
                <span style="display:flex; align-items:center; padding:0 10px; font-weight:600; font-size:0.95em;">Trang ${page} / ${pages}</span>
                <button class="btn btn-secondary" id="btn-entity-next" ${page >= pages ? 'disabled' : ''}>Sau ▶</button>
            </div>
        </div>
    `;

    $('admin-search-entities').addEventListener('input', e => {
        state.search = e.target.value;
        state.page = 1;
        renderAdminTab();
    });
    if ($('btn-admin-search-entities-clear')) {
        $('btn-admin-search-entities-clear').addEventListener('click', () => {
            state.search = '';
            state.page = 1;
            renderAdminTab();
        });
    }
    $('btn-entity-prev').addEventListener('click', () => { state.page--; renderAdminTab(); });
    $('btn-entity-next').addEventListener('click', () => { state.page++; renderAdminTab(); });

    $('btn-admin-add-entity').addEventListener('click', async () => {
        const code = $('admin-add-entity-code').value.trim();
        const name = $('admin-add-entity-name').value.trim();
        if (!code || !name) return showToast('Vui lòng nhập đầy đủ thông tin (*)', true);

        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await addEntity(code, name);
            }
            localAppData.ENTITIES[code] = name;
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã thêm đối tượng thành công');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    });
}

window.deleteAdminEntity = async function(code) {
    if (confirm(`Bạn có chắc chắn muốn xóa đối tượng ${code}?`)) {
        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await deleteEntity(code);
            }
            delete localAppData.ENTITIES[code];
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã xóa đối tượng');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    }
};

window.editAdminEntity = async function(code, oldName) {
    let newName = prompt(`Nhập tên mới cho đối tượng [${code}]:`, oldName);
    if (newName === null) return;
    newName = newName.trim();
    if (!newName) return showToast('Tên đối tượng không được để trống', true);

    showLoading();
    try {
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            await updateEntity(code, newName);
        }
        localAppData.ENTITIES[code] = newName;
        localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
        showToast('Đã cập nhật tên đối tượng');
        renderAdminTab();
    } catch (err) {
        console.error(err);
        showToast('Lỗi: ' + err.message, true);
    } finally {
        hideLoading();
    }
};

// 2. Mapping Dictionary (dm_doi_tuong) Panel
function renderMappingPanel(container) {
    const state = adminPagination.mapping;
    const filtered = localAppData.DM_DOI_TUONG.filter(item => {
        const s = state.search.toLowerCase();
        return !s || item.keyword.toLowerCase().includes(s) || item.code.toLowerCase().includes(s);
    });
    filtered.sort((a, b) => a.keyword.localeCompare(b.keyword));

    const total = filtered.length;
    const pages = Math.ceil(total / state.limit) || 1;
    const page = Math.min(state.page, pages);
    state.page = page;
    const start = (page - 1) * state.limit;
    const paginated = filtered.slice(start, start + state.limit);

    container.innerHTML = `
        <h2 style="margin:0; font-size:1.4rem;">🔍 Từ điển Ánh xạ Mã Đối Tượng</h2>
        <div class="admin-search-bar">
            <input type="text" id="admin-search-mapping" class="form-control" placeholder="Tìm theo Từ khóa hoặc Mã..." value="${state.search}">
            ${state.search ? '<button class="btn btn-secondary" id="btn-admin-search-mapping-clear">✖</button>' : ''}
        </div>
        <div class="form-row">
            <div class="form-group" style="flex:2;">
                <label>Từ khóa đối sánh (*)</label>
                <input type="text" id="admin-add-mapping-kw" class="form-control" placeholder="VD: CONG TY CO PHAN CANG VIET NAM">
            </div>
            <div class="form-group">
                <label>Mã Đối Tượng tương ứng (*)</label>
                <input type="text" id="admin-add-mapping-code" class="form-control" placeholder="VD: 0315895749.CAVINA">
            </div>
            <button class="btn btn-primary" id="btn-admin-add-mapping" style="padding:10px 20px;">➕ Thêm</button>
        </div>
        <div class="table-container glass-panel" style="flex:1; overflow-y:auto; max-height:480px;">
            <table style="width:100%;">
                <thead>
                    <tr>
                        <th>Từ khóa đối sánh</th>
                        <th style="width:250px;">Mã Đối Tượng</th>
                        <th style="width:140px; text-align:center;">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginated.map(item => `
                        <tr>
                            <td style="font-weight:600; color:var(--primary);">${item.keyword}</td>
                            <td>
                                <span class="badge" style="background:rgba(255,255,255,0.08);">${item.code}</span>
                                <span style="font-size:0.85em; color:var(--text-muted); margin-left:8px;">${localAppData.ENTITIES[item.code] || ''}</span>
                            </td>
                            <td style="text-align:center; display:flex; gap:6px; justify-content:center;">
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.85em;" onclick="editAdminMapping('${item.keyword.replace(/'/g, "\\'")}', '${item.code}')">✏ Sửa</button>
                                <button class="btn btn-secondary text-danger" style="padding:4px 8px; font-size:0.85em;" onclick="deleteAdminMapping('${item.keyword.replace(/'/g, "\\'")}')">🗑 Xóa</button>
                            </td>
                        </tr>
                    `).join('')}
                    ${paginated.length === 0 ? '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Không tìm thấy luật ánh xạ phù hợp.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
        <div class="pagination-container">
            <div style="font-size:0.9em; color:var(--text-muted);">Hiển thị ${total ? start + 1 : 0} - ${Math.min(start + paginated.length, total)} / Tổng số ${total} bản ghi</div>
            <div class="pagination-buttons">
                <button class="btn btn-secondary" id="btn-mapping-prev" ${page <= 1 ? 'disabled' : ''}>◀ Trước</button>
                <span style="display:flex; align-items:center; padding:0 10px; font-weight:600; font-size:0.95em;">Trang ${page} / ${pages}</span>
                <button class="btn btn-secondary" id="btn-mapping-next" ${page >= pages ? 'disabled' : ''}>Sau ▶</button>
            </div>
        </div>
    `;

    $('admin-search-mapping').addEventListener('input', e => {
        state.search = e.target.value;
        state.page = 1;
        renderAdminTab();
    });
    if ($('btn-admin-search-mapping-clear')) {
        $('btn-admin-search-mapping-clear').addEventListener('click', () => {
            state.search = '';
            state.page = 1;
            renderAdminTab();
        });
    }
    $('btn-mapping-prev').addEventListener('click', () => { state.page--; renderAdminTab(); });
    $('btn-mapping-next').addEventListener('click', () => { state.page++; renderAdminTab(); });

    $('btn-admin-add-mapping').addEventListener('click', async () => {
        const kw = $('admin-add-mapping-kw').value.trim();
        const code = $('admin-add-mapping-code').value.trim();
        if (!kw || !code) return showToast('Vui lòng nhập đầy đủ thông tin (*)', true);

        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await addMappingRule(kw, code);
            }
            localAppData.DM_DOI_TUONG.unshift({ keyword: kw, code });
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã thêm quy tắc ánh xạ thành công');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    });
}

window.deleteAdminMapping = async function(kw) {
    if (confirm(`Bạn có chắc chắn muốn xóa quy tắc ánh xạ [${kw}]?`)) {
        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await deleteMappingRule(kw);
            }
            localAppData.DM_DOI_TUONG = localAppData.DM_DOI_TUONG.filter(r => r.keyword !== kw);
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã xóa quy tắc ánh xạ');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    }
};

window.editAdminMapping = async function(kw, oldCode) {
    let newCode = prompt(`Nhập Mã đối tượng mới cho Từ khóa [${kw}]:`, oldCode);
    if (newCode === null) return;
    newCode = newCode.trim();
    if (!newCode) return showToast('Mã đối tượng không được để trống', true);

    showLoading();
    try {
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            await updateMappingRule(kw, newCode);
        }
        let match = localAppData.DM_DOI_TUONG.find(r => r.keyword === kw);
        if (match) match.code = newCode;
        localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
        showToast('Đã cập nhật mã đối tượng');
        renderAdminTab();
    } catch (err) {
        console.error(err);
        showToast('Lỗi: ' + err.message, true);
    } finally {
        hideLoading();
    }
};

// 3. Bank Accounts (master_accounts) Panel
function renderAccountsPanel(container) {
    const state = adminPagination.accounts;
    const all = Object.keys(localAppData.MASTER).map(num => ({ number: num, ...localAppData.MASTER[num] }));
    const filtered = all.filter(item => {
        const s = state.search.toLowerCase();
        return !s || item.number.includes(s) || item.bank.toLowerCase().includes(s) || item.description.toLowerCase().includes(s);
    });

    container.innerHTML = `
        <h2 style="margin:0; font-size:1.4rem;">💳 Danh mục Tài khoản Ngân hàng (Master)</h2>
        <div class="admin-search-bar">
            <input type="text" id="admin-search-accounts" class="form-control" placeholder="Tìm theo số tài khoản, ngân hàng..." value="${state.search}">
        </div>
        <div class="form-row" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:end;">
            <div class="form-group">
                <label>Số tài khoản (*)</label>
                <input type="text" id="acc-add-num" class="form-control" placeholder="VD: 8600098886">
            </div>
            <div class="form-group">
                <label>Ngân hàng (*)</label>
                <select id="acc-add-bank" class="form-control" style="padding:8px;">
                    <option value="BIDV">BIDV</option>
                    <option value="MB">MB Bank</option>
                </select>
            </div>
            <div class="form-group">
                <label>Mã viết tắt (*)</label>
                <input type="text" id="acc-add-short" class="form-control" placeholder="VD: B8886">
            </div>
            <div class="form-group">
                <label>Mã định khoản kế toán (*)</label>
                <input type="text" id="acc-add-code" class="form-control" placeholder="VD: 1121B8886">
            </div>
            <div class="form-group">
                <label>Tên tài khoản / Diễn giải (*)</label>
                <input type="text" id="acc-add-desc" class="form-control" placeholder="VD: TKTG VND BIDV">
            </div>
            <div class="form-group">
                <label>Chi nhánh mở (*)</label>
                <input type="text" id="acc-add-branch" class="form-control" placeholder="VD: Chi nhánh Bình Chánh">
            </div>
            <button class="btn btn-primary" id="btn-admin-add-account" style="padding:10px; width:100%; grid-column: 1 / -1;">➕ Thêm Tài khoản</button>
        </div>
        <div class="table-container glass-panel" style="flex:1; overflow-y:auto; max-height:480px;">
            <table style="width:100%;">
                <thead>
                    <tr>
                        <th>Tài khoản / Ngân hàng</th>
                        <th>Mã Viết Tắt</th>
                        <th>TK Định Khoản</th>
                        <th>Diễn Giải / Chi nhánh</th>
                        <th style="width:140px; text-align:center;">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(item => `
                        <tr>
                            <td>
                                <strong style="font-size:1.05em; color:var(--primary);">${item.number}</strong><br>
                                <span style="font-size:0.85em; color:var(--text-muted); font-weight:600;">${item.bank}</span>
                            </td>
                            <td><span class="badge" style="background:rgba(255,255,255,0.08);">${item.shortCode}</span></td>
                            <td><strong>${item.accouantCode}</strong></td>
                            <td>
                                <strong>${item.description}</strong><br>
                                <span style="font-size:0.85em; color:var(--text-muted);">${item.branch}</span>
                            </td>
                            <td style="text-align:center; display:flex; gap:6px; justify-content:center; align-items:center;">
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.85em;" onclick="editAdminAccount('${item.number}', '${item.bank}', '${item.shortCode}', '${item.accouantCode}', '${item.description.replace(/'/g, "\\'")}', '${item.branch.replace(/'/g, "\\'")}')">✏ Sửa</button>
                                <button class="btn btn-secondary text-danger" style="padding:4px 8px; font-size:0.85em;" onclick="deleteAdminAccount('${item.number}')">🗑 Xóa</button>
                            </td>
                        </tr>
                    `).join('')}
                    ${filtered.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Không tìm thấy tài khoản ngân hàng nào.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;

    $('admin-search-accounts').addEventListener('input', e => {
        state.search = e.target.value;
        renderAdminTab();
    });

    $('btn-admin-add-account').addEventListener('click', async () => {
        const num = $('acc-add-num').value.trim();
        const bank = $('acc-add-bank').value;
        const short = $('acc-add-short').value.trim();
        const code = $('acc-add-code').value.trim();
        const desc = $('acc-add-desc').value.trim();
        const branch = $('acc-add-branch').value.trim();

        if (!num || !short || !code || !desc || !branch) return showToast('Vui lòng nhập đầy đủ thông tin tài khoản', true);

        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await addMasterAccount(num, bank, short, code, desc, branch);
            }
            localAppData.MASTER[num] = { bank, shortCode: short, accouantCode: code, description: desc, branch };
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã thêm tài khoản ngân hàng mới');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    });
}

window.deleteAdminAccount = async function(num) {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản ngân hàng [${num}]?`)) {
        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await deleteMasterAccount(num);
            }
            delete localAppData.MASTER[num];
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã xóa tài khoản ngân hàng');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    }
};

window.editAdminAccount = async function(num, bank, short, code, desc, branch) {
    const newDesc = prompt(`Nhập Diễn giải mới cho tài khoản [${num}]:`, desc);
    if (newDesc === null) return;
    const newBranch = prompt(`Nhập Chi nhánh mới cho tài khoản [${num}]:`, branch);
    if (newBranch === null) return;

    showLoading();
    try {
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            await updateMasterAccount(num, bank, short, code, newDesc.trim(), newBranch.trim());
        }
        localAppData.MASTER[num] = { bank, shortCode: short, accouantCode: code, description: newDesc.trim(), branch: newBranch.trim() };
        localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
        showToast('Đã cập nhật tài khoản ngân hàng');
        renderAdminTab();
    } catch (err) {
        console.error(err);
        showToast('Lỗi: ' + err.message, true);
    } finally {
        hideLoading();
    }
};

// 4. Accounting Rules (accounting_rules) Panel
function renderRulesPanel(container) {
    const state = adminPagination.rules;
    const filtered = localAppData.ACCOUNTING_RULES.filter(item => {
        const s = state.search.toLowerCase();
        return !s || item.keyword.toLowerCase().includes(s) || (item.tkNo && item.tkNo.includes(s)) || (item.tkCo && item.tkCo.includes(s));
    });
    filtered.sort((a, b) => a.keyword.localeCompare(b.keyword));

    container.innerHTML = `
        <h2 style="margin:0; font-size:1.4rem;">📋 Quy tắc định khoản kế toán tự động</h2>
        <div class="admin-search-bar">
            <input type="text" id="admin-search-rules" class="form-control" placeholder="Tìm theo từ khóa, số tài khoản..." value="${state.search}">
        </div>
        <div class="form-row">
            <div class="form-group" style="flex:2;">
                <label>Từ khóa diễn giải (*)</label>
                <input type="text" id="rule-add-kw" class="form-control" placeholder="VD: TAM UNG, PHI QLY">
            </div>
            <div class="form-group" style="width:120px; flex:none;">
                <label>Loại Phiếu</label>
                <select id="rule-add-type" class="form-control" style="padding:8px;">
                    <option value="CHI">Báo Nợ (Chi)</option>
                    <option value="THU">Báo Có (Thu)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tài khoản Nợ</label>
                <input type="text" id="rule-add-tkno" class="form-control" placeholder="VD: 642">
            </div>
            <div class="form-group">
                <label>Tài khoản Có</label>
                <input type="text" id="rule-add-tkco" class="form-control" placeholder="VD: 1121">
            </div>
            <button class="btn btn-primary" id="btn-admin-add-rule" style="padding:10px 20px;">➕ Thêm</button>
        </div>
        <div class="table-container glass-panel" style="flex:1; overflow-y:auto; max-height:480px;">
            <table style="width:100%;">
                <thead>
                    <tr>
                        <th>Từ khóa diễn giải</th>
                        <th style="width:140px; text-align:center;">Loại Phiếu</th>
                        <th style="width:120px; text-align:center;">TK Nợ</th>
                        <th style="width:120px; text-align:center;">TK Có</th>
                        <th style="width:140px; text-align:center;">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(item => `
                        <tr>
                            <td style="font-weight:600; color:var(--primary);">${item.keyword}</td>
                            <td style="text-align:center;">
                                <span class="${item.isThu ? 'admin-badge-thu' : 'admin-badge-chi'}">${item.isThu ? 'Báo Có' : 'Báo Nợ'}</span>
                            </td>
                            <td style="text-align:center; font-weight:600;">${item.tkNo || '-'}</td>
                            <td style="text-align:center; font-weight:600;">${item.tkCo || '-'}</td>
                            <td style="text-align:center; display:flex; gap:6px; justify-content:center;">
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.85em;" onclick="editAdminAccountingRule('${item.keyword.replace(/'/g, "\\'")}', ${item.isThu}, '${item.tkNo}', '${item.tkCo}')">✏ Sửa</button>
                                <button class="btn btn-secondary text-danger" style="padding:4px 8px; font-size:0.85em;" onclick="deleteAdminAccountingRule('${item.keyword.replace(/'/g, "\\'")}')">🗑 Xóa</button>
                            </td>
                        </tr>
                    `).join('')}
                    ${filtered.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Không tìm thấy quy tắc nào.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;

    $('admin-search-rules').addEventListener('input', e => {
        state.search = e.target.value;
        renderAdminTab();
    });

    $('btn-admin-add-rule').addEventListener('click', async () => {
        const kw = $('rule-add-kw').value.trim();
        const type = $('rule-add-type').value;
        const tkno = $('rule-add-tkno').value.trim();
        const tkco = $('rule-add-tkco').value.trim();

        if (!kw) return showToast('Vui lòng điền Từ khóa', true);

        showLoading();
        try {
            const isThu = type === 'THU';
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await addAccountingRule(kw.toUpperCase(), isThu, tkno, tkco);
            }
            localAppData.ACCOUNTING_RULES.unshift({ keyword: kw.toUpperCase(), isThu, tkNo: tkno, tkCo: tkco });
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã thêm quy tắc hạch toán mới');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    });
}

window.deleteAdminAccountingRule = async function(kw) {
    if (confirm(`Bạn có chắc chắn muốn xóa quy tắc định khoản [${kw}]?`)) {
        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await deleteAccountingRule(kw);
            }
            localAppData.ACCOUNTING_RULES = localAppData.ACCOUNTING_RULES.filter(r => r.keyword !== kw);
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã xóa quy tắc định khoản');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    }
};

window.editAdminAccountingRule = async function(kw, isThu, oldTkNo, oldTkCo) {
    const newTkNo = prompt(`Nhập TK Nợ mới cho quy tắc [${kw}]:`, oldTkNo);
    if (newTkNo === null) return;
    const newTkCo = prompt(`Nhập TK Có mới cho quy tắc [${kw}]:`, oldTkCo);
    if (newTkCo === null) return;

    showLoading();
    try {
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            await updateAccountingRule(kw, isThu, newTkNo.trim(), newTkCo.trim());
        }
        let match = localAppData.ACCOUNTING_RULES.find(r => r.keyword === kw);
        if (match) {
            match.tkNo = newTkNo.trim();
            match.tkCo = newTkCo.trim();
        }
        localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
        showToast('Đã cập nhật định khoản');
        renderAdminTab();
    } catch (err) {
        console.error(err);
        showToast('Lỗi: ' + err.message, true);
    } finally {
        hideLoading();
    }
};

// 5. Special Extraction Rules (special_rules) Panel
function renderSpecialRulesPanel(container) {
    const state = adminPagination.special;
    const filtered = localAppData.SPECIAL_RULES.filter(item => {
        const s = state.search.toLowerCase();
        return !s || item.condition.toLowerCase().includes(s) || item.format.toLowerCase().includes(s);
    });

    container.innerHTML = `
        <h2 style="margin:0; font-size:1.4rem;">⚙️ Quy tắc Cắt trích thông tin nâng cao (Special Rules)</h2>
        <div class="admin-search-bar">
            <input type="text" id="admin-search-special" class="form-control" placeholder="Tìm theo điều kiện, định dạng..." value="${state.search}">
        </div>
        <div class="form-row" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:end;">
            <div class="form-group" style="grid-column: 1 / span 2;">
                <label>Điều kiện matching (&& để nối nhiều điều kiện) (*)</label>
                <input type="text" id="sr-add-cond" class="form-control" placeholder="VD: NGUYEN THI B&&TAM UNG">
            </div>
            <div class="form-group">
                <label>Cắt từ chữ</label>
                <input type="text" id="sr-add-from" class="form-control" placeholder="VD: CK">
            </div>
            <div class="form-group">
                <label>Đến chữ</label>
                <input type="text" id="sr-add-to" class="form-control" placeholder="VD: SANG">
            </div>
            <div class="form-group" style="grid-column: 1 / span 2;">
                <label>Định dạng đầu ra (*)</label>
                <input type="text" id="sr-add-format" class="form-control" placeholder="VD: {KEYWORD} - {NAME} - {MATCH}">
            </div>
            <button class="btn btn-primary" id="btn-admin-add-special" style="padding:10px; width:100%; grid-column: 1 / -1;">➕ Thêm Quy Tắc</button>
        </div>
        <div class="table-container glass-panel" style="flex:1; overflow-y:auto; max-height:480px;">
            <table style="width:100%;">
                <thead>
                    <tr>
                        <th>Điều kiện matches</th>
                        <th>Khoảng trích xuất</th>
                        <th>Định dạng đầu ra</th>
                        <th style="width:100px; text-align:center;">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(item => `
                        <tr>
                            <td style="font-weight:600; color:var(--primary);">${item.condition}</td>
                            <td>
                                ${item.cutFrom || item.cutTo ? `
                                    Cắt từ: <span class="badge" style="background:rgba(255,255,255,0.08);">${item.cutFrom || 'Bắt đầu'}</span> 
                                    đến: <span class="badge" style="background:rgba(255,255,255,0.08);">${item.cutTo || 'Kết thúc'}</span>
                                ` : '<span style="color:var(--text-muted);font-style:italic;">Không cắt (Chỉ định dạng)</span>'}
                            </td>
                            <td><strong>${item.format}</strong></td>
                            <td style="text-align:center;">
                                <button class="btn btn-secondary text-danger" style="padding:4px 8px; font-size:0.85em;" onclick="deleteAdminSpecialRule('${item.condition.replace(/'/g, "\\'")}')">🗑 Xóa</button>
                            </td>
                        </tr>
                    `).join('')}
                    ${filtered.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Không tìm thấy quy tắc đặc biệt nào.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;

    $('admin-search-special').addEventListener('input', e => {
        state.search = e.target.value;
        renderAdminTab();
    });

    $('btn-admin-add-special').addEventListener('click', async () => {
        const cond = $('sr-add-cond').value.trim();
        const from = $('sr-add-from').value.trim();
        const to = $('sr-add-to').value.trim();
        const format = $('sr-add-format').value.trim();

        if (!cond || !format) return showToast('Vui lòng nhập Điều kiện và Định dạng (*)', true);

        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await addSpecialRule(cond, from, to, format);
            }
            localAppData.SPECIAL_RULES.unshift({ condition: cond, cutFrom: from, cutTo: to, format });
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã thêm quy tắc cắt trích nâng cao');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    });
}

window.deleteAdminSpecialRule = async function(cond) {
    if (confirm(`Bạn có chắc chắn muốn xóa quy tắc cắt trích [${cond}]?`)) {
        showLoading();
        try {
            if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                await deleteSpecialRule(cond);
            }
            localAppData.SPECIAL_RULES = localAppData.SPECIAL_RULES.filter(r => r.condition !== cond);
            localStorage.setItem('bankMasterData', JSON.stringify(localAppData));
            showToast('Đã xóa quy tắc cắt trích');
            renderAdminTab();
        } catch (err) {
            console.error(err);
            showToast('Lỗi: ' + err.message, true);
        } finally {
            hideLoading();
        }
    }
};
