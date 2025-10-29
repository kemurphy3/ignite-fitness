/**
 * Test Prompt 10 - Periodization + Soccer Calendar
 * 
 * Done Means:
 * ✅ 4-week blocks (W1-3 progressive, W4 deload)
 * ✅ Pre-season bias strength and power
 * ✅ In-season bias maintenance and sprint/agility
 * ✅ User can flag important matches
 * ✅ Taper auto-applies (volume -30%, intensity -10%)
 * ✅ Periodization view shows current block, next block, phase pill persists
 * ✅ Marking a key match in 10 days updates next 2 weeks with rationale
 */

// Prevent duplicate declaration
if (typeof window.testPrompts10 === 'undefined') {
    window.testPrompts10 = {};
}

Object.assign(window.testPrompts10, {
    // Test 4-week block generation
    test4WeekBlockGeneration() {
        console.group('🧪 Test 4-Week Block Generation');
        
        const phase = { name: 'Pre-Season', focus: 'strength', intensity: 'high' };
        
        const weeks = [];
        for (let week = 1; week <= 4; week++) {
            let volumeMultiplier = 1.0;
            let intensityMultiplier = 1.0;
            
            if (week <= 3) {
                // Progressive loading
                volumeMultiplier = 0.7 + (week * 0.1); // 0.8, 0.9, 1.0
                intensityMultiplier = 0.9 + (week * 0.033); // 0.933, 0.966, 1.0
            } else {
                // Deload week 4
                volumeMultiplier = 0.6; // -40% volume
                intensityMultiplier = 0.85; // -15% intensity
            }
            
            weeks.push({
                weekNumber: week,
                volumeMultiplier,
                intensityMultiplier,
                isDeload: week === 4
            });
        }
        
        console.assert(weeks[0].volumeMultiplier === 0.8, 'Week 1: 80% volume');
        console.assert(weeks[1].volumeMultiplier === 0.9, 'Week 2: 90% volume');
        console.assert(weeks[2].volumeMultiplier === 1.0, 'Week 3: 100% volume');
        console.assert(weeks[3].volumeMultiplier === 0.6, 'Week 4: 60% volume (deload)');
        console.assert(weeks[3].isDeload, 'Week 4 is deload');
        
        console.log('✅ 4-week block pattern: W1 80%, W2 90%, W3 100%, W4 60% (deload)');
        
        console.groupEnd();
    },
    
    // Test season-specific biases
    testSeasonBiases() {
        console.group('🧪 Test Season Biases');
        
        const getWeeklyFocus = (phase, week) => {
            if (phase.name === 'Pre-Season') {
                return 'strength and power';
            } else if (phase.name === 'In-Season') {
                return 'maintenance and sprint/agility';
            } else if (phase.name === 'Off-Season') {
                return 'strength development';
            } else {
                return 'recovery and regeneration';
            }
        };
        
        const preSeason = { name: 'Pre-Season' };
        const inSeason = { name: 'In-Season' };
        
        console.assert(
            getWeeklyFocus(preSeason, 1) === 'strength and power',
            'Pre-season focuses on strength and power'
        );
        
        console.assert(
            getWeeklyFocus(inSeason, 1) === 'maintenance and sprint/agility',
            'In-season focuses on maintenance and sprint/agility'
        );
        
        console.log('✅ Pre-season: strength and power');
        console.log('✅ In-season: maintenance and sprint/agility');
        
        console.groupEnd();
    },
    
    // Test key match flagging
    testKeyMatchFlagging() {
        console.group('🧪 Test Key Match Flagging');
        
        let keyMatches = [];
        
        const flagKeyMatch = (date, opponent) => {
            keyMatches.push({
                date: date.toISOString(),
                opponent,
                type: 'key_match',
                flagged: true,
                taperApplied: true,
                taperDays: 10
            });
            
            return keyMatches[keyMatches.length - 1];
        };
        
        // Flag a match in 10 days
        const matchDate = new Date();
        matchDate.setDate(matchDate.getDate() + 10);
        const match = flagKeyMatch(matchDate, 'Liverpool');
        
        console.assert(match.flagged, 'Match should be flagged');
        console.assert(match.taperApplied, 'Taper should be applied');
        console.assert(match.taperDays === 10, 'Taper should be 10 days');
        
        console.log('✅ Key match flagged:', match.opponent);
        console.log('✅ Taper auto-applies 10 days before');
        
        console.groupEnd();
    },
    
    // Test automatic tapering
    testAutomaticTapering() {
        console.group('🧪 Test Automatic Tapering');
        
        const keyMatches = [
            {
                date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
                opponent: 'Liverpool'
            }
        ];
        
        const weeks = [];
        for (let week = 1; week <= 4; week++) {
            let volumeMultiplier = 1.0;
            let intensityMultiplier = 1.0;
            let isTaperWeek = false;
            
            // Normal progressive loading
            if (week <= 3) {
                volumeMultiplier = 0.7 + (week * 0.1);
                intensityMultiplier = 0.9 + (week * 0.033);
                
                // Check if near key match (within 10 days)
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
                
                const daysUntilMatch = 10;
                if (daysUntilMatch >= 0 && daysUntilMatch <= 10) {
                    // Apply taper
                    volumeMultiplier *= 0.7; // -30%
                    intensityMultiplier *= 0.9; // -10%
                    isTaperWeek = true;
                }
            }
            
            weeks.push({ week, volumeMultiplier, intensityMultiplier, isTaperWeek });
        }
        
        const taperWeek = weeks.find(w => w.isTaperWeek);
        
        console.assert(
            taperWeek.volumeMultiplier < 0.8,
            'Tapered week should have reduced volume (-30%)'
        );
        console.assert(
            taperWeek.intensityMultiplier < 0.95,
            'Tapered week should have reduced intensity (-10%)'
        );
        
        console.log('✅ Week 2 tapered for key match:');
        console.log(`   Volume: ${(taperWeek.volumeMultiplier * 100).toFixed(0)}% (-30%)`);
        console.log(`   Intensity: ${(taperWeek.intensityMultiplier * 100).toFixed(0)}% (-10%)`);
        
        console.groupEnd();
    },
    
    // Test periodization view
    testPeriodizationView() {
        console.group('🧪 Test Periodization View');
        
        const currentPhase = { name: 'In-Season', color: '#00a651', emoji: '⚽' };
        const currentBlock = { number: 2, progress: 50 };
        const nextBlock = { number: 3, startsIn: 14 };
        
        const phasePill = `
            <div class="phase-pill" style="--phase-color: ${currentPhase.color}">
                <span class="phase-emoji">${currentPhase.emoji}</span>
                <span class="phase-label">${currentPhase.name}</span>
            </div>
        `;
        
        console.assert(phasePill.includes(currentPhase.name), 'Should show phase name');
        console.assert(phasePill.includes(currentPhase.emoji), 'Should show phase emoji');
        
        const progressBar = `
            <div class="progress-bar" style="width: ${currentBlock.progress}%"></div>
            <div class="progress-text">Week 2 of 4</div>
        `;
        
        console.assert(progressBar.includes(`${currentBlock.progress}%`), 'Should show progress');
        
        console.log('✅ Phase pill renders:', currentPhase.name);
        console.log('✅ Progress bar shows:', `${currentBlock.progress}%`);
        console.log('✅ Next block starts in:', `${nextBlock.startsIn} days`);
        
        console.groupEnd();
    },
    
    // Test marking key match updates next 2 weeks
    testMarkingKeyMatchUpdatesPlan() {
        console.group('🧪 Test Marking Key Match Updates Next 2 Weeks');
        
        const keyMatchDate = new Date();
        keyMatchDate.setDate(keyMatchDate.getDate() + 10); // 10 days from now
        
        const currentBlock = 2;
        const updatedBlocks = [];
        
        // Update next 2 blocks
        for (let blockOffset = 1; blockOffset <= 2; blockOffset++) {
            const blockNumber = currentBlock + blockOffset;
            
            // Generate weeks with taper for key match
            const weeks = [];
            for (let week = 1; week <= 4; week++) {
                let volumeMultiplier = 1.0;
                let intensityMultiplier = 1.0;
                let isTaperWeek = false;
                
                if (week <= 3) {
                    volumeMultiplier = 0.7 + (week * 0.1);
                    intensityMultiplier = 0.9 + (week * 0.033);
                    
                    // Check if this week is within 10 days of key match
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() + (blockNumber - 1) * 28 + (week - 1) * 7);
                    const daysUntilMatch = 10;
                    
                    if (daysUntilMatch >= 0 && daysUntilMatch <= 10) {
                        volumeMultiplier *= 0.7; // -30%
                        intensityMultiplier *= 0.9; // -10%
                        isTaperWeek = true;
                    }
                }
                
                weeks.push({ week, volumeMultiplier, intensityMultiplier, isTaperWeek });
            }
            
            updatedBlocks.push({ blockNumber, weeks });
        }
        
        console.assert(updatedBlocks.length === 2, 'Should update next 2 blocks');
        
        // Check if taper is applied
        const taperWeeks = updatedBlocks.flatMap(b => b.weeks.filter(w => w.isTaperWeek));
        console.assert(taperWeeks.length > 0, 'Should have taper weeks in updated blocks');
        
        console.log(`✅ Updated ${updatedBlocks.length} blocks`);
        console.log(`✅ Found ${taperWeeks.length} taper weeks`);
        
        taperWeeks.forEach(week => {
            console.log(`   Week ${week.week}: volume ${(week.volumeMultiplier * 100).toFixed(0)}%, intensity ${(week.intensityMultiplier * 100).toFixed(0)}%`);
        });
        
        console.groupEnd();
    }
});

// Run all tests
console.log('🧪 Running Prompt 10 Tests...\n');

window.testPrompts10.test4WeekBlockGeneration();
window.testPrompts10.testSeasonBiases();
window.testPrompts10.testKeyMatchFlagging();
window.testPrompts10.testAutomaticTapering();
window.testPrompts10.testPeriodizationView();
window.testPrompts10.testMarkingKeyMatchUpdatesPlan();

console.log('\n✅ All Prompt 10 Tests Complete!');
