// グローバル変数
let csvData = null;
let pdfData = null;

// PDF.js設定（エラーハンドリング付き）
try {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('✅ PDF.js worker configured');
    } else {
        console.error('❌ pdfjsLib is not available');
    }
} catch (error) {
    console.error('❌ PDF.js configuration error:', error);
}

// DOM読み込み後に初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 アプリケーション初期化中...');
    
    try {
        // ファイルアップロード処理
        const csvInput = document.getElementById('csvFile');
        const pdfInput = document.getElementById('pdfFile');
        
        console.log('🔍 Elements found:', {
            csvInput: !!csvInput,
            pdfInput: !!pdfInput
        });
        
        if (csvInput) {
            csvInput.addEventListener('change', handleCsvFile);
            console.log('✅ CSV input listener added');
            
            // テスト用のクリックイベントも追加
            csvInput.addEventListener('click', function() {
                console.log('👆 CSV input clicked');
            });
        } else {
            console.error('❌ CSV input not found');
        }
        
        if (pdfInput) {
            pdfInput.addEventListener('change', handlePdfFile);
            console.log('✅ PDF input listener added');
            
            // テスト用のクリックイベントも追加
            pdfInput.addEventListener('click', function() {
                console.log('👆 PDF input clicked');
            });
        } else {
            console.error('❌ PDF input not found');
        }
        
        // ドラッグ&ドロップ対応
        try {
            setupDragAndDrop('csvUploadBox', 'csvFile');
            setupDragAndDrop('pdfUploadBox', 'pdfFile');
            console.log('✅ Drag & drop setup completed');
        } catch (dragError) {
            console.error('❌ Drag & drop setup error:', dragError);
        }
        
        console.log('🎯 初期化完了');
        
    } catch (error) {
        console.error('❌ 初期化エラー:', error);
    }
});

async function handleCsvFile(event) {
    console.log('📁 CSV file selected');
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ No file selected');
        return;
    }
    
    console.log('📄 File info:', {
        name: file.name,
        size: file.size,
        type: file.type
    });
    
    try {
        showFileInfo('csvFileInfo', file.name, 'loading');
        console.log('⏳ Starting CSV parsing...');
        csvData = await parseCSV(file);
        console.log('✅ CSV parsing completed:', csvData.length, 'records');
        showFileInfo('csvFileInfo', file.name, 'success');
        updateCompareButton();
    } catch (error) {
        console.error('❌ CSV parsing error:', error);
        showFileInfo('csvFileInfo', file.name, 'error');
        showError('CSVファイルの読み込みに失敗しました: ' + error.message);
    }
}

async function handlePdfFile(event) {
    console.log('📁 PDF file selected');
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ No file selected');
        return;
    }
    
    console.log('📄 File info:', {
        name: file.name,
        size: file.size,
        type: file.type
    });
    
    try {
        showFileInfo('pdfFileInfo', file.name, 'loading');
        console.log('⏳ Starting PDF parsing...');
        pdfData = await parsePDF(file);
        console.log('✅ PDF parsing completed:', pdfData.length, 'records');
        showFileInfo('pdfFileInfo', file.name, 'success');
        updateCompareButton();
    } catch (error) {
        console.error('❌ PDF parsing error:', error);
        showFileInfo('pdfFileInfo', file.name, 'error');
        showError('PDFファイルの読み込みに失敗しました: ' + error.message);
    }
}

// CSV解析関数（UTF-16LE対応）
async function parseCSV(file) {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let text;
    
    // UTF-16LE BOM検出 (FF FE)
    if (uint8Array.length >= 2 && uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
        const decoder = new TextDecoder('utf-16le');
        text = decoder.decode(arrayBuffer);
    } else {
        // UTF-8として試行
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(arrayBuffer);
    }
    
    // BOMを除去
    text = text.replace(/^\uFEFF/, '');
    
    const lines = text.split(/\r?\n/);
    const headers = lines[0].split('\t');
    
    // 必要な列のインデックスを取得
    const dateIndex = headers.indexOf('日付');
    const timeIndex = headers.indexOf('時間');
    const netSalesIndex = headers.indexOf('純売上高');
    const taxIndex = headers.indexOf('税金');
    const discountIndex = headers.indexOf('ディスカウント');
    const detailsIndex = headers.indexOf('詳細');
    
    if (dateIndex === -1 || timeIndex === -1 || netSalesIndex === -1 || taxIndex === -1) {
        throw new Error('必要な列が見つかりません');
    }
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split('\t');
        if (columns.length < Math.max(dateIndex, timeIndex, netSalesIndex, taxIndex, discountIndex, detailsIndex) + 1) {
            continue;
        }
        
        const date = columns[dateIndex];
        const time = columns[timeIndex];
        const netSales = parseAmount(columns[netSalesIndex]);
        const tax = parseAmount(columns[taxIndex]);
        const discount = parseAmount(columns[discountIndex]);
        const details = columns[detailsIndex] || '';
        
        // 純売上高 + 税金 = サロンボードの現計に対応
        const totalAmount = netSales + tax;
        
        // 担当者名を詳細から抽出
        const staffName = extractStaffName(details);
        
        if (date && time && !isNaN(totalAmount)) {
            data.push({
                date,
                time,
                totalAmount, // 純売上高 + 税金
                discount: Math.abs(discount), // 絶対値に変換
                staffName,
                details,
                source: 'Square'
            });
        }
    }
    
    console.log('CSV解析結果:', data);
    return data;
}

// PDF解析関数
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    let allText = '';
    
    // 1ページ目はスキップ（レジ締め情報の概要のため）
    for (let pageNum = 2; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        allText += pageText + '\n';
    }
    
    // PDFからデータを抽出
    const data = extractPDFData(allText);
    console.log('PDF解析結果:', data);
    return data;
}

// PDFデータ抽出関数
function extractPDFData(text) {
    const data = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    console.log('📄 PDF全文長:', text.length);
    console.log('📄 PDF行数:', lines.length);
    console.log('📄 PDF最初の20行:', lines.slice(0, 20).join(' | '));
    
    // サロンボードPDFの詳細なパターンマッチング
    let currentDate = null;
    const extractedData = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // より柔軟な日付パターン (2025/6/22, 2025-06-22, 令和7年6月22日 など)
        const datePatterns = [
            /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
            /令和(\d+)年(\d{1,2})月(\d{1,2})日/,
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
            /(\d{1,2})-(\d{1,2})-(\d{4})/
        ];
        
        for (const pattern of datePatterns) {
            const dateMatch = line.match(pattern);
            if (dateMatch) {
                if (pattern.source.includes('令和')) {
                    const reiwaYear = parseInt(dateMatch[1]) + 2018;
                    currentDate = `${reiwaYear}/${parseInt(dateMatch[2])}/${parseInt(dateMatch[3])}`;
                } else if (pattern.source.includes('(\\d{4})')) {
                    currentDate = `${dateMatch[1]}/${parseInt(dateMatch[2])}/${parseInt(dateMatch[3])}`;
                } else {
                    currentDate = `${dateMatch[3]}/${parseInt(dateMatch[1])}/${parseInt(dateMatch[2])}`;
                }
                console.log('📅 Found date:', currentDate);
                break;
            }
        }
        
        // 時間と金額、担当者を同じ行または近隣行で検索
        const timeMatch = line.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (timeMatch) {
            const time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}${timeMatch[3] ? ':' + timeMatch[3] : ''}`;
            
            // 現在行と前後数行で金額と担当者を検索
            const contextLines = lines.slice(Math.max(0, i-2), i+3).join(' ');
            
            // 金額パターン（¥マーク付き、カンマ区切り対応）
            const amountMatches = contextLines.match(/¥[\\d,]+/g);
            
            // 日本人名パターン（カタカナ、ひらがな、漢字）
            const staffPatterns = [
                /[ァ-ヴ]{2,8}/,  // カタカナ
                /[ひ-ゞ]{2,8}/,  // ひらがな
                /[一-龯]{2,6}/   // 漢字
            ];
            
            let staffName = '';
            for (const pattern of staffPatterns) {
                const staffMatch = contextLines.match(pattern);
                if (staffMatch) {
                    staffName = staffMatch[0];
                    break;
                }
            }
            
            if (amountMatches && currentDate) {
                const totalAmount = parseAmount(amountMatches[0]);
                const pointUsage = amountMatches.length > 1 ? parseAmount(amountMatches[1]) : 0;
                
                if (totalAmount > 0) {
                    const record = {
                        date: currentDate,
                        time: time,
                        totalAmount: totalAmount,
                        pointUsage: pointUsage,
                        staffName: staffName,
                        source: 'SalonBoard',
                        originalLine: line
                    };
                    extractedData.push(record);
                    console.log('📋 Extracted:', record);
                }
            }
        }
    }
    
    // 実際のサロンボードPDFからデータを抽出
    const realData = extractRealSalonBoardData(text);
    
    if (realData.length === 0) {
        console.log('⚠️ PDFから有効なデータが抽出できませんでした。');
    }
    
    return realData;
}

// 実際のサロンボードPDFからデータを抽出する関数
function extractRealSalonBoardData(text) {
    const data = [];
    console.log('🔍 実際のサロンボードデータを抽出中...');
    
    // 正規表現で「適 格 請 求 書 発 ⾏ 事 業 者」から次の同パターンまたは文末までを抽出
    // スペースと特殊文字（⾏）に注意
    const transactionPattern = /適\s*格\s*請\s*求\s*書\s*発\s*[⾏行]\s*事\s*業\s*者.*?(?=適\s*格\s*請\s*求\s*書\s*発\s*[⾏行]\s*事\s*業\s*者|$)/gs;
    const transactions = text.match(transactionPattern) || [];
    
    console.log(`📝 正規表現で抽出した取引数: ${transactions.length}個`);
    
    for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        console.log(`\n🔍 取引 ${i + 1}: 長さ=${transaction.length}`);
        console.log(`  内容: ${transaction.substring(0, 200)}...`);
        
        try {
            // 日時抽出: 会計日時の後の日時パターン（スペースと特殊文字に対応）
            const dateTimeMatch = transaction.match(/会\s*計\s*[⽇日]\s*時\s+(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})/);
            if (!dateTimeMatch) {
                console.log('  ❌ 日時が見つかりません');
                console.log(`  デバッグ: ${transaction.substring(0, 100)}`);
                continue;
            }
            
            const date = dateTimeMatch[1];
            const time = dateTimeMatch[2];
            console.log(`  📅 日時: ${date} ${time}`);
            
            // 担当者抽出: スペース入りの「担 当 スタイリスト」から「レジ 担 当」まで
            const staffMatch = transaction.match(/担\s*当\s*スタイリスト\s+(.+?)\s+レジ\s*担\s*当/);
            let staffName = '';
            if (staffMatch) {
                // スペースを除去し、特殊文字を正規化
                staffName = staffMatch[1]
                    .replace(/\s+/g, '')  // スペース除去
                    .replace(/⽥/g, '田')  // 特殊文字正規化
                    .replace(/⼠/g, '士')  // 特殊文字正規化
                    .replace(/⼤/g, '大')  // 特殊文字正規化
                    .replace(/⼭/g, '山')  // 特殊文字正規化
                    .trim();
            } else {
                console.log(`  デバッグ担当者: ${transaction.substring(0, 150)}`);
            }
            console.log(`  👤 担当者: "${staffName}"`);
            
            // 現計抽出
            const totalMatch = transaction.match(/現計\s+([\d,]+)\s*円/);
            if (!totalMatch) {
                console.log('  ❌ 現計が見つかりません');
                continue;
            }
            const totalAmount = parseInt(totalMatch[1].replace(/,/g, ''));
            console.log(`  💰 現計: ${totalAmount}円`);
            
            // ポイント抽出（ない場合は0）
            const pointMatch = transaction.match(/ポイント\s*利\s*[⽤用]\s*額\s+([\d,]+)\s*円/);
            const pointUsage = pointMatch ? parseInt(pointMatch[1].replace(/,/g, '')) : 0;
            console.log(`  🎯 ポイント: ${pointUsage}円`);
            
            // データを追加
            const record = {
                date: date,
                time: time,
                totalAmount: totalAmount,
                pointUsage: pointUsage,
                staffName: staffName,
                source: 'SalonBoard',
                originalLine: transaction.substring(0, 100) + '...'
            };
            
            data.push(record);
            console.log(`  ✅ 抽出成功:`, record);
            
        } catch (error) {
            console.error(`  ❌ 取引 ${i + 1} 処理エラー:`, error);
        }
    }
    
    console.log(`🎯 最終抽出結果: ${data.length}件`);
    return data;
}

// フォールバック用のPDF抽出関数
function extractPDFDataFallback(text) {
    const data = [];
    
    console.log('PDF Fallback - Text length:', text.length);
    console.log('PDF Fallback - First 500 chars:', text.substring(0, 500));
    
    // ユーザーに状況を説明
    showError(`
        <strong>⚠️ PDF読み取り状況</strong><br>
        現在、サロンボードPDFの自動読み取り機能を開発中です。<br>
        <strong>テストモード</strong>で動作しており、以下の4件のサンプルデータで照合しています：<br>
        • 孝明 (¥4,700)<br>
        • 貴士 (¥7,500)<br>
        • 岩田 (¥6,600)<br>
        • ジロウ (¥4,400)<br><br>
        <strong>実際のPDFデータを読み取るには、PDFの構造分析が必要です。</strong>
    `);
    
    // 実際のSquareデータに合わせたテストデータを生成
    return [
        {
            date: '2025/6/22',
            time: '19:00:25',
            totalAmount: 4700, // Square: 孝明 ¥4,700
            pointUsage: 800,   // Square: 割引¥800
            staffName: '孝明',
            source: 'SalonBoard',
            originalLine: 'テストデータ - 孝明'
        },
        {
            date: '2025/6/22',
            time: '18:58:35',
            totalAmount: 7500, // Square: 貴士 ¥7,500
            pointUsage: 200,   // Square: 割引¥200
            staffName: '貴士',
            source: 'SalonBoard',
            originalLine: 'テストデータ - 貴士'
        },
        {
            date: '2025/6/22',
            time: '18:57:53',
            totalAmount: 6600, // Square: 岩田 ¥6,600
            pointUsage: 0,     // Square: 割引¥0
            staffName: '岩田',
            source: 'SalonBoard',
            originalLine: 'テストデータ - 岩田'
        },
        {
            date: '2025/6/22',
            time: '18:57:24',
            totalAmount: 4400, // Square: ジロウ ¥4,400
            pointUsage: 0,     // Square: 割引¥0
            staffName: 'ジロウ',
            source: 'SalonBoard',
            originalLine: 'テストデータ - ジロウ'
        }
    ];
}

// 金額パース関数
function parseAmount(amountStr) {
    if (!amountStr || amountStr === '¥0' || amountStr === '0') return 0;
    
    // "¥4,200" や ¥-800 のような形式から数値を抽出
    const cleaned = amountStr
        .replace(/["¥,]/g, '') // ダブルクォート、¥、カンマを除去
        .replace(/\s/g, ''); // スペースを除去
    
    return parseInt(cleaned, 10) || 0;
}

// 担当者名抽出関数
function extractStaffName(details) {
    if (!details) return '';
    
    // ダブルクォートを除去してから名前を抽出
    const cleaned = details.replace(/^"/, '').replace(/"$/, '');
    
    // "貴士 (定価)" のような形式から名前を抽出
    const match = cleaned.match(/^([^\s(]+)/);
    return match ? match[1] : '';
}

// データ照合関数
function compareData() {
    if (!csvData || !pdfData) {
        showError('両方のファイルをアップロードしてください');
        return;
    }
    
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsContent').innerHTML = '<div class="loading">照合中...</div>';
    
    setTimeout(() => {
        try {
            const differences = findDifferences(csvData, pdfData);
            displayResults(differences);
        } catch (error) {
            showError('照合処理中にエラーが発生しました: ' + error.message);
        }
    }, 100);
}

// 差分検出関数
function findDifferences(squareData, salonData) {
    const differences = [];
    
    console.log('🔍 照合開始');
    console.log('Square records:', squareData.length);
    console.log('Salon records:', salonData.length);
    
    for (const squareRecord of squareData) {
        console.log(`\n📊 Square: ${squareRecord.date} ${squareRecord.time} ${squareRecord.staffName} ¥${squareRecord.totalAmount}`);
        
        // 日付、時間、担当者で一致するレコードを検索
        const matchingRecords = salonData.filter(salonRecord => {
            const dateMatch = compareDates(squareRecord.date, salonRecord.date);
            const timeMatch = compareTimes(squareRecord.time, salonRecord.time);
            const staffMatch = compareStaffNames(squareRecord.staffName, salonRecord.staffName);
            
            console.log(`  🔗 Salon: ${salonRecord.date} ${salonRecord.time} ${salonRecord.staffName} ¥${salonRecord.totalAmount}`);
            console.log(`    Date: ${dateMatch}, Time: ${timeMatch}, Staff: ${staffMatch}`);
            
            return dateMatch && timeMatch && staffMatch;
        });
        
        if (matchingRecords.length === 0) {
            console.log('  ❌ No matching records found');
            differences.push({
                type: 'missing_in_salon',
                square: squareRecord,
                salon: null,
                issue: 'サロンボードに対応するレコードが見つかりません'
            });
        } else {
            console.log(`  ✅ Found ${matchingRecords.length} matching record(s)`);
            
            // 金額とポイントの差分をチェック
            for (const salonRecord of matchingRecords) {
                const amountDiff = Math.abs(squareRecord.totalAmount - salonRecord.totalAmount);
                const pointDiff = Math.abs(squareRecord.discount - salonRecord.pointUsage);
                
                console.log(`    Amount diff: ${amountDiff}, Point diff: ${pointDiff}`);
                
                if (amountDiff > 0 || pointDiff > 0) {
                    differences.push({
                        type: 'amount_difference',
                        square: squareRecord,
                        salon: salonRecord,
                        amountDiff,
                        pointDiff,
                        issue: `金額差分: ${amountDiff}円, ポイント差分: ${pointDiff}円`
                    });
                }
            }
        }
    }
    
    console.log(`\n📋 総差分数: ${differences.length}`);
    return differences;
}

// 日付比較関数
function compareDates(date1, date2) {
    // 2025/6/22 のような形式を正規化
    const normalize = (date) => {
        const parts = date.split('/');
        return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
    };
    
    return normalize(date1) === normalize(date2);
}

// 時間比較関数
function compareTimes(time1, time2) {
    // 時間の差が5分以内なら一致とみなす
    const parseTime = (timeStr) => {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + (seconds || 0);
    };
    
    const diff = Math.abs(parseTime(time1) - parseTime(time2));
    return diff <= 300; // 5分以内
}

// 担当者名比較関数
function compareStaffNames(name1, name2) {
    if (!name1 || !name2) return false;
    
    // 部分一致をチェック（「清田 貴士」→「貴士」のケースに対応）
    return name1.includes(name2) || name2.includes(name1);
}

// 結果表示関数
function displayResults(differences) {
    const resultsContent = document.getElementById('resultsContent');
    
    if (differences.length === 0) {
        resultsContent.innerHTML = '<div class="success">差分は見つかりませんでした。データは正常です。</div>';
        return;
    }
    
    let html = `<div class="error">差分が${differences.length}件見つかりました。</div>`;
    html += '<table class="result-table">';
    html += '<thead><tr>';
    html += '<th>種類</th><th>日付</th><th>時間</th><th>担当者</th>';
    html += '<th>Square金額</th><th>サロン金額</th><th>Square割引</th><th>サロンポイント</th>';
    html += '<th>問題</th>';
    html += '</tr></thead><tbody>';
    
    for (const diff of differences) {
        html += '<tr class="difference">';
        html += `<td>${diff.type === 'missing_in_salon' ? '欠損' : '差分'}</td>`;
        html += `<td>${diff.square.date}</td>`;
        html += `<td>${diff.square.time}</td>`;
        html += `<td>${diff.square.staffName}</td>`;
        html += `<td>¥${diff.square.totalAmount.toLocaleString()}</td>`;
        html += `<td>${diff.salon ? '¥' + diff.salon.totalAmount.toLocaleString() : '-'}</td>`;
        html += `<td>¥${diff.square.discount.toLocaleString()}</td>`;
        html += `<td>${diff.salon ? '¥' + diff.salon.pointUsage.toLocaleString() : '-'}</td>`;
        html += `<td>${diff.issue}</td>`;
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    resultsContent.innerHTML = html;
}

// ユーティリティ関数
function setupDragAndDrop(boxId, inputId) {
    const box = document.getElementById(boxId);
    const input = document.getElementById(inputId);
    
    box.addEventListener('dragover', (e) => {
        e.preventDefault();
        box.classList.add('dragover');
    });
    
    box.addEventListener('dragleave', () => {
        box.classList.remove('dragover');
    });
    
    box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            input.dispatchEvent(new Event('change'));
        }
    });
}

function showFileInfo(elementId, filename, status) {
    const element = document.getElementById(elementId);
    element.style.display = 'block';
    
    if (status === 'loading') {
        element.innerHTML = `📄 ${filename} - 読み込み中...`;
        element.style.background = '#fff3cd';
    } else if (status === 'success') {
        element.innerHTML = `✅ ${filename} - 読み込み完了`;
        element.style.background = '#d4edda';
    } else if (status === 'error') {
        element.innerHTML = `❌ ${filename} - エラー`;
        element.style.background = '#f8d7da';
    }
}

function updateCompareButton() {
    const compareBtn = document.getElementById('compareBtn');
    compareBtn.disabled = !(csvData && pdfData);
}

function showError(message) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');
    
    resultsSection.style.display = 'block';
    resultsContent.innerHTML = `<div class="error">${message}</div>`;
}