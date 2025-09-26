// migrate-to-connection-pooling.js
// Script to update all Netlify functions to use centralized connection pooling

const fs = require('fs');
const path = require('path');

function updateFileToUseConnectionPooling(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Pattern 1: Direct neon() calls
        if (content.includes('const sql = neon(process.env.DATABASE_URL)')) {
            content = content.replace(
                /const sql = neon\(process\.env\.DATABASE_URL\);/g,
                'const { getNeonClient } = require(\'./utils/connection-pool\');\nconst sql = getNeonClient();'
            );
            modified = true;
        }
        
        // Pattern 2: neon() calls inside functions
        if (content.includes('const sql = neon(process.env.DATABASE_URL)') && !content.includes('getNeonClient')) {
            content = content.replace(
                /const sql = neon\(process\.env\.DATABASE_URL\);/g,
                'const { getNeonClient } = require(\'./utils/connection-pool\');\nconst sql = getNeonClient();'
            );
            modified = true;
        }
        
        // Pattern 3: Inline neon() calls
        if (content.includes('neon(process.env.DATABASE_URL)') && !content.includes('getNeonClient')) {
            content = content.replace(
                /neon\(process\.env\.DATABASE_URL\)/g,
                'getNeonClient()'
            );
            
            // Add import if not present
            if (!content.includes('getNeonClient')) {
                const importLine = "const { getNeonClient } = require('./utils/connection-pool');";
                const lines = content.split('\n');
                const firstImportIndex = lines.findIndex(line => line.startsWith('const ') || line.startsWith('require('));
                if (firstImportIndex >= 0) {
                    lines.splice(firstImportIndex, 0, importLine);
                    content = lines.join('\n');
                } else {
                    content = importLine + '\n' + content;
                }
            }
            modified = true;
        }
        
        // Pattern 4: Update require statements for _base.js
        if (content.includes("require('./_base')") && content.includes('getDB')) {
            // This file already uses the updated _base.js, no changes needed
            modified = false;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Updated: ${filePath}`);
            return true;
        } else {
            console.log(`⏭️  No changes needed: ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.log(`❌ Error updating ${filePath}: ${error.message}`);
        return false;
    }
}

function migrateToConnectionPooling() {
    console.log('🔄 Migrating Netlify Functions to Use Connection Pooling\n');
    
    const functionsDir = path.join(__dirname, 'netlify', 'functions');
    const filesToUpdate = [];
    
    // Find all JavaScript files in the functions directory
    function findJSFiles(dir) {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                findJSFiles(filePath);
            } else if (file.endsWith('.js') && !file.includes('connection-pool')) {
                filesToUpdate.push(filePath);
            }
        });
    }
    
    findJSFiles(functionsDir);
    
    console.log(`📝 Found ${filesToUpdate.length} files to check\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    filesToUpdate.forEach(filePath => {
        const relativePath = path.relative(process.cwd(), filePath);
        
        try {
            const result = updateFileToUseConnectionPooling(filePath);
            if (result) {
                updatedCount++;
            } else {
                skippedCount++;
            }
        } catch (error) {
            console.log(`❌ Error processing ${relativePath}: ${error.message}`);
            errorCount++;
        }
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Files updated: ${updatedCount}`);
    console.log(`⏭️  Files skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Success rate: ${Math.round((updatedCount / filesToUpdate.length) * 100)}%`);
    
    if (errorCount === 0) {
        console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('   All functions now use centralized connection pooling.');
        console.log('   Run "node test-connection-pooling.js" to verify the implementation.');
    } else {
        console.log(`\n⚠️  Migration completed with ${errorCount} errors.`);
        console.log('   Review the errors above and fix manually if needed.');
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateToConnectionPooling();
}

module.exports = { migrateToConnectionPooling, updateFileToUseConnectionPooling };
