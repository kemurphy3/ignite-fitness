// debug-cursor.js
// Debug cursor encoding/decoding issue

const { encodeCursor, decodeCursor } = require('./netlify/functions/utils/pagination');

function debugCursor() {
    console.log('🔍 Debugging Cursor Encoding/Decoding\n');
    
    const testData = { id: '123', timestamp: '2024-01-01T00:00:00Z', order: '2024-01-01T00:00:00Z' };
    
    console.log('📊 Original data:');
    console.log(JSON.stringify(testData, null, 2));
    
    try {
        console.log('\n📊 Encoding cursor...');
        const encoded = encodeCursor(testData);
        console.log(`✅ Encoded: ${encoded}`);
        console.log(`✅ Length: ${encoded.length}`);
        
        console.log('\n📊 Decoding cursor...');
        const decoded = decodeCursor(encoded);
        console.log('✅ Decoded:');
        console.log(JSON.stringify(decoded, null, 2));
        
        console.log('\n📊 Comparison:');
        console.log(`Original: ${JSON.stringify(testData)}`);
        console.log(`Decoded:  ${JSON.stringify(decoded)}`);
        console.log(`Match: ${JSON.stringify(decoded) === JSON.stringify(testData)}`);
        
        // Check each field
        console.log('\n📊 Field comparison:');
        console.log(`ID: ${testData.id} === ${decoded.id} ? ${testData.id === decoded.id}`);
        console.log(`Timestamp: ${testData.timestamp} === ${decoded.timestamp} ? ${testData.timestamp === decoded.timestamp}`);
        console.log(`Order: ${testData.order} === ${decoded.order} ? ${testData.order === decoded.order}`);
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(`❌ Stack: ${error.stack}`);
    }
}

debugCursor();
