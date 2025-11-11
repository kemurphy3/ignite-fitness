# DISCUSSION: Multi-Sport Expansion Features

**⚠️ NOTE: This is a discussion/brainstorming document only. These features are
NOT to be implemented or built yet. This is for future reference and planning
purposes only.**

## Overview

Expanding the app beyond soccer to support multiple sports with sport-specific
training adaptations.

## Sport Selection During Initialization

### Available Sports

- Soccer (with season dates)
- Basketball (with season dates)
- Tennis (with tournament schedule)
- Climbing (year-round or seasonal)
- Running (race dates)
- Golf (tournament schedule)
- Hockey (season dates)
- Volleyball (season/beach season)
- Swimming (meet schedule)
- "Pickup/Recreational" (no specific season, just stay ready)
- "General Athletic" (multi-sport fitness)

### Training Mode Options

- **In-Season Training**: Maintenance mode, injury prevention focus, lower
  volume
- **Off-Season Training**: Build strength/power, address weaknesses, higher
  volume
- **Pre-Season Prep**: Sport-specific conditioning, ramp up intensity
- **Year-Round Fitness**: Always ready for pickup games, balanced approach

### Activity Schedule Input

Users can mark when they already play their sport:

- "I play Tuesdays/Thursdays" → Program recovery around those days
- "Weekend warrior" → Heavy legs Monday, recovered by Saturday
- "Random pickup games" → Maintain readiness, no heavy days
- "Daily practice" → Minimal leg volume, focus on recovery
- "Tournament weekends" → Taper Thursday/Friday

## Sport-Specific Training Adaptations

### Basketball

- **Exercise Focus**: Plyometrics, vertical jump, lateral quickness
- **Key Areas**: Ankle stability, knee health, explosive power
- **Avoid**: Heavy legs day before games, excessive running volume
- **Special Considerations**: More upper body than soccer, rotational core

### Soccer

- **Exercise Focus**: Hamstring resilience, single-leg strength, aerobic base
- **Key Areas**: ACL prevention, hip mobility, deceleration control
- **Avoid**: Heavy quads before games, excessive upper body mass
- **Special Considerations**: Field position matters (keeper vs striker)

### Tennis

- **Exercise Focus**: Rotator cuff, forearm strength, lateral movement
- **Key Areas**: Core rotation, shoulder stability, quick direction changes
- **Avoid**: Heavy shoulder work before matches, grip-intensive training before
  tournaments
- **Special Considerations**: Serving arm needs extra care

### Climbing

- **Exercise Focus**: Grip strength, pull-up progressions, finger protocols
- **Key Areas**: Antagonist training (push exercises), shoulder health
- **Avoid**: Pumped forearms before climbing days, excessive leg mass
- **Special Considerations**: Indoor vs outdoor season affects programming

### Running

- **Exercise Focus**: Single-leg stability, posterior chain, core endurance
- **Key Areas**: Hip strength, calf resilience, injury prevention
- **Avoid**: Heavy legs before long runs, excessive upper body mass
- **Special Considerations**: Distance vs sprint focus completely changes
  programming

### Golf

- **Exercise Focus**: Rotational power, hip mobility, core stability
- **Key Areas**: Thoracic spine mobility, wrist strength, balance
- **Avoid**: Heavy grip work before rounds, excessive bulk
- **Special Considerations**: Back health is critical, asymmetric sport

## AI Prompt Adjustments

The expert system weightings would shift based on sport:

- **Contact sports**: More physical therapist input
- **Aesthetic sports**: More aesthetics coach input
- **Endurance sports**: More conditioning focus
- **Power sports**: More S&C coach input

## Smart Programming Features

### Automatic Adjustments

- Detect game/competition days from calendar
- Auto-deload before important events
- Adjust volume based on sport schedule
- Prevent interference (don't train what they're playing)

### Recovery Optimization

- Know that soccer = legs tired, program upper body
- Know that climbing = grip/pulling tired, program legs/pushing
- Know that tennis = dominant arm tired, focus on balance

### Seasonal Periodization

- Track sport seasons automatically
- Shift focus as season progresses
- Build base in off-season, maintain in-season
- Peak for playoffs/tournaments

## Implementation Considerations (When Ready)

### Database Changes Needed

- User sport selection field
- Season/schedule tracking
- Sport-specific baseline tests
- Position/role within sport

### UI Changes Needed

- Sport selection during onboarding
- Schedule input interface
- Sport-specific progress metrics
- Competition calendar integration

### AI Context Additions

- Sport-specific injury history
- Performance in sport (win/loss, stats)
- Fatigue from sport participation
- Sport-specific goals

## Benefits of Multi-Sport Support

1. **Broader Market**: Not just soccer players
2. **Year-Round Relevance**: Different sports, different seasons
3. **Cross-Training**: Athletes doing multiple sports
4. **Pickup Players**: Large market of recreational athletes
5. **Injury Prevention**: Sport-specific weak points addressed

## Questions for Future Development

1. How granular should position-specific training be? (QB vs lineman)
2. Should youth sports have different protocols?
3. How to handle multi-sport athletes? Priority system?
4. Integration with sport performance metrics? (Vertical jump, 40-yard dash)
5. Sport-specific warm-ups for game days?

---

**Remember: This document is for discussion and planning only. Do not implement
these features until explicitly requested.**
