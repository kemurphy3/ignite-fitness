// test-setup-verification.js
// Verify that the test setup is working correctly

const fs = require('fs');
const path = require('path');

function verifyTestSetup() {
    console.log('🔍 Verifying Test Setup\n');
    
    const checks = [
        {
            name: 'package.json has test scripts',
            check: () => {
                const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
                return packageJson.scripts.test && packageJson.scripts['test:run'] && packageJson.scripts['test:coverage'];
            }
        },
        {
            name: 'vitest.config.js exists',
            check: () => fs.existsSync('vitest.config.js')
        },
        {
            name: 'tests directory exists',
            check: () => fs.existsSync('tests')
        },
        {
            name: 'tests/setup.js exists',
            check: () => fs.existsSync('tests/setup.js')
        },
        {
            name: 'tests/helpers directory exists',
            check: () => fs.existsSync('tests/helpers')
        },
        {
            name: 'tests/helpers/database.js exists',
            check: () => fs.existsSync('tests/helpers/database.js')
        },
        {
            name: 'tests/helpers/environment.js exists',
            check: () => fs.existsSync('tests/helpers/environment.js')
        },
        {
            name: 'tests/unit directory exists',
            check: () => fs.existsSync('tests/unit')
        },
        {
            name: 'tests/integration directory exists',
            check: () => fs.existsSync('tests/integration')
        },
        {
            name: 'Unit test files exist',
            check: () => {
                const unitFiles = fs.readdirSync('tests/unit');
                return unitFiles.some(file => file.endsWith('.test.js'));
            }
        },
        {
            name: 'Integration test files exist',
            check: () => {
                const integrationFiles = fs.readdirSync('tests/integration');
                return integrationFiles.some(file => file.endsWith('.test.js'));
            }
        },
        {
            name: 'README.md has testing section',
            check: () => {
                const readme = fs.readFileSync('README.md', 'utf8');
                return readme.includes('## 🧪 Testing');
            }
        }
    ];
    
    let passed = 0;
    let total = checks.length;
    
    checks.forEach(check => {
        try {
            const result = check.check();
            console.log(`${result ? '✅' : '❌'} ${check.name}`);
            if (result) passed++;
        } catch (error) {
            console.log(`❌ ${check.name} - Error: ${error.message}`);
        }
    });
    
    console.log(`\n📊 Test Setup Verification: ${passed}/${total} checks passed`);
    
    if (passed === total) {
        console.log('🎉 Test setup is complete and ready!');
        console.log('\nNext steps:');
        console.log('1. Run: npm install');
        console.log('2. Set up .env.test with your test database URL');
        console.log('3. Run: npm test');
    } else {
        console.log('❌ Some setup items are missing. Please check the failed items above.');
    }
}

verifyTestSetup();
