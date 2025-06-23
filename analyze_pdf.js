// Node.js用のPDF分析スクリプト
const fs = require('fs');

// PDF.jsライブラリを模擬して、実際のPDFテキストを分析
function analyzePDFStructure() {
    console.log('🔍 サンプルPDFの構造分析を開始...');
    
    // 実際のPDFから抽出されたテキスト（コンソールログから取得）
    const sampleText = `適 格 請 求 書 発 ⾏ 事 業 者   -  会 計 ⽇ 時   2025/06/22 11:19  担 当 スタイリスト   清 ⽥   貴 ⼠  レジ 担 当   清 ⽥   貴 ⼠  会 計 ID   SB000600786969  メニュ ー   【 清 ⽥ 専 ⽤ 】 メンズカット   1   点   7,700   円  合 計   7,700   円   ( 内 消 費 税   700   円 )  7,700   円  700   円  ポイント 利 ⽤ 額   400   円  現計   7,300   円  お 預 り  現 ⾦  7,300   円  7,300   円  お 釣 り   0   円  適 格 請 求 書 発 ⾏ 事 業 者   -  会 計 ⽇ 時   2025/06/22 11:25  担 当 スタイリスト   岩 ⽥   光  レジ 担 当   岩 ⽥   光  会 計 ID   SB000600789796  メニュ ー   トップスタイリストカット ( …   1   点   6,600   円  合 計   6,600   円   ( 内 消 費 税   600   円 )  6,600   円  600   円  ポイント 利 ⽤ 額   100   円  現計   6,500   円  お 預 り  VISA/JCB/M ASTER/AMEX  6,500   円  6,500   円  お 釣 り   0   円`;
    
    console.log('📄 テキスト分析結果:');
    console.log(`全文長: ${sampleText.length}`);
    
    // 各取引を「適格請求書発行事業者」で分割
    const transactions = sampleText.split('適 格 請 求 書 発 ⾏ 事 業 者');
    console.log(`\\n📋 「適格請求書発行事業者」で分割: ${transactions.length}個`);
    
    for (let i = 1; i < transactions.length; i++) {
        const transaction = transactions[i];
        console.log(`\\n=== 取引 ${i} ===`);
        console.log(`長さ: ${transaction.length}`);
        console.log(`内容: ${transaction.substring(0, 200)}...`);
        
        // 日時抽出
        const dateTimeMatch = transaction.match(/(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})/);
        if (dateTimeMatch) {
            console.log(`📅 日時: ${dateTimeMatch[1]}`);
        }
        
        // 担当者抽出
        const staffMatch = transaction.match(/担 当 スタイリスト\s+([^\s]+(?:\s+[^\s]+)*?)\s+レジ/);
        if (staffMatch) {
            console.log(`👤 担当者: ${staffMatch[1]}`);
        }
        
        // 現計抽出
        const totalMatch = transaction.match(/現計\s+([\d,]+)\s*円/);
        if (totalMatch) {
            console.log(`💰 現計: ${totalMatch[1]}円`);
        }
        
        // ポイント抽出
        const pointMatch = transaction.match(/ポイント利\s*⽤\s*額\s+([\d,]+)\s*円/);
        if (pointMatch) {
            console.log(`🎯 ポイント: ${pointMatch[1]}円`);
        }
    }
    
    return {
        totalTransactions: transactions.length - 1,
        sampleTransactionData: transactions.slice(1, 3)
    };
}

// 修正版の抽出ロジックを提案
function proposePDFExtractionFix() {
    console.log('\\n🔧 修正案:');
    console.log('1. 「適格請求書発行事業者」で分割するのが最適');
    console.log('2. 各取引内で日時、担当者、現計、ポイントを抽出');
    console.log('3. 特殊文字（⽤、⽥、⼠）を正規化');
    
    const fixedCode = `
// 修正版のPDF抽出関数
function extractRealSalonBoardData(text) {
    const data = [];
    
    // 「適格請求書発行事業者」で取引を分割
    const transactions = text.split('適格請求書発行事業者').filter(t => t.trim().length > 0);
    
    for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        
        // 日時抽出
        const dateTimeMatch = transaction.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})/);
        if (!dateTimeMatch) continue;
        
        const date = dateTimeMatch[1];
        const time = dateTimeMatch[2];
        
        // 担当者抽出（スペースを考慮）
        const staffMatch = transaction.match(/担当スタイリスト\s+([^\s]+(?:\s+[^\s]+)*?)\s+レジ/);
        let staffName = staffMatch ? staffMatch[1].replace(/\s+/g, '') : '';
        
        // 特殊文字正規化
        staffName = staffName.replace(/⽥/g, '田').replace(/⼠/g, '士');
        
        // 現計抽出
        const totalMatch = transaction.match(/現計\s+([\d,]+)\s*円/);
        if (!totalMatch) continue;
        const totalAmount = parseInt(totalMatch[1].replace(/,/g, ''));
        
        // ポイント抽出
        const pointMatch = transaction.match(/ポイント利[⽤用]額\s+([\d,]+)\s*円/);
        const pointUsage = pointMatch ? parseInt(pointMatch[1].replace(/,/g, '')) : 0;
        
        data.push({
            date: date,
            time: time,
            totalAmount: totalAmount,
            pointUsage: pointUsage,
            staffName: staffName,
            source: 'SalonBoard'
        });
    }
    
    return data;
}`;
    
    console.log(fixedCode);
}

// 実行
const result = analyzePDFStructure();
proposePDFExtractionFix();