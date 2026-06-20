You are a senior gameplay engineer specializing in 11v11 football simulation.

I have a TypeScript football simulation on a 2D pitch with coordinates x: 0-100 and y: 0-100. The match is a fast arcade simulation, not real-time physics. I want you to refactor and fix the movement AI, off-ball logic, pressing logic, passing support, and shooting decision.

Current problems:

1. Defenders stay too deep near the goalkeeper and do not push up when the team attacks.
2. When the opponent attacks, defenders do not press or step out aggressively enough.
3. Fullbacks with the ball dribble too close to the touchline instead of choosing natural overlap, underlap, cross, cutback, or safe pass options.
4. Wingers with the ball also dribble too wide toward the touchline instead of cutting inside, combining, crossing, or attacking half-spaces.
5. When the team loses possession, the defensive team lacks pressing, 1v1 marking, cover shadows, and recovery runs.
6. When attacking, the team lacks combination play, triangles, support runs, overlaps, underlaps, and passing lanes.
7. Only the ball carrier moves actively. Off-ball players are too static.

Main objective:

Refactor the AI so every player updates movement intention every simulation tick, not only the ball carrier or players near the ball.

The final behavior should feel like football:

- Defenders move as a line.
- Midfielders move as a block.
- Attackers search for space.
- Fullbacks overlap and underlap.
- Wingers sometimes stay wide, sometimes cut inside.
- Strikers make runs between defenders.
- Midfielders create passing triangles.
- Defensive team presses, marks, covers, and tracks runners.
- The team shape moves together based on possession, ball zone, and tactical phase.

Do not make players chase exact coordinates. Players should move toward useful tactical zones.

Core architectural change:

Every tick, every player must evaluate an intent.

Possible intents:

- DRIBBLE
- PASS_SUPPORT
- ATTACK_SPACE
- OVERLAP
- UNDERLAP
- CUT_INSIDE
- HOLD_WIDTH
- HOLD_DEPTH
- PRESS_BALL
- COVER_SPACE
- MARK_MAN
- TRACK_RUNNER
- RECOVER_SHAPE
- HOLD_LINE
- RECEIVE_PASS

Ball proximity must affect priority, not whether the player moves.

Wrong structure:

if player is near ball:
update movement
else:
stand still

Correct structure:

for every player every tick:
evaluate possession phase
evaluate ball zone
evaluate role responsibility
evaluate nearby teammates
evaluate nearby opponents
evaluate tactical shape
evaluate off-ball intent
evaluate ball-related action only as an additional priority
combine all movement influences into final target

Phase logic:

There must be at least 5 tactical phases:

1. IN_POSSESSION_BUILDUP
2. IN_POSSESSION_ATTACK
3. DEFENSIVE_PRESS
4. DEFENSIVE_BLOCK
5. TRANSITION_LOST_BALL
6. TRANSITION_WON_BALL

When team has possession:

Defenders:

- Push up with the team.
- CBs should not stay near the goalkeeper.
- CB line should move closer to midfield when the ball is in the opponent half.
- CBs should maintain rest-defense shape, usually 2v1 or 2v2 against opponent forwards.
- Fullbacks should support attack depending on ball side.
- Ball-side fullback may overlap or underlap.
- Far-side fullback should tuck inside slightly as rest defense.

Midfielders:

- Must move beyond the halfway line when the team attacks.
- DM should stay behind the ball as rest defense.
- CM should offer forward and diagonal passing lanes.
- CAM/CM should occupy half-space between opponent midfield and defense.
- Midfielders should not all stand behind the ball.
- At least two passing options should be created near the ball carrier when possible.

Wingers:

- Ball-side winger should choose between:
  - hold width
  - cut inside
  - attack half-space
  - combine with fullback
  - cross

- Winger should not always dribble to the touchline.
- If already near the sideline, winger should prefer cut inside, pass backward, cross, or switch play.
- Far-side winger should attack back post or stay wide for switch depending on ball location.

Striker:

- Should not stand still.
- Should move between CBs.
- Should attack space behind the defensive line.
- Should drop short occasionally to receive.
- Should stay mostly onside.
- Should not shoot from unrealistic distance.
- Should look for pass, layoff, through run, or shot depending on distance and angle.

When opponent has possession:

Defenders:

- Defensive line should shift together.
- If ball enters defender's responsibility zone, nearest defender should step out to press.
- Other defenders must cover behind the presser.
- CBs should not all stay flat near the goalkeeper.
- Fullbacks must press wide attackers on their side.
- Far-side defenders tuck inside.
- Dangerous runners must be tracked 1v1.
- If an opponent forward enters a CB zone, one CB marks, the other covers.
- Defenders should decide between PRESS_BALL, MARK_MAN, COVER_SPACE, TRACK_RUNNER, HOLD_LINE.

Midfielders:

- Ball-side midfielder presses or blocks lane.
- Other midfielders screen central passing lanes.
- DM protects the space in front of CBs.
- Midfield line should move horizontally with the ball.
- Midfielders should mark nearby opponents between the lines.

Wingers:

- Track opponent fullbacks.
- Press wide buildup when ball is on their side.
- Far-side winger compresses inward but remains available for counterattack.

Striker:

- Press center backs or screen passes into midfield.
- Striker should not fully drop into defense unless tactic requires it.

Pressing logic:

Implement pressing as a coordinated system, not random chasing.

When possession is lost:

- For first 3-5 ticks, trigger counter-press.
- Nearest 2-3 players press aggressively.
- Nearby teammates cover passing lanes.
- Back line pushes up slightly if safe.
- If counter-press fails, team drops into defensive block.

When defending normally:

- If ball is wide, fullback/winger presses.
- If ball is central, CM/DM/ST presses depending on zone.
- CB only steps out if:
  - ball is in dangerous central area
  - opponent receives between lines
  - nearest midfielder cannot press
  - there is cover behind

- If CB steps out, another CB or DM covers depth.

1v1 marking logic:

Every defensive player should evaluate nearby opponents.

Marking priority:

1. Opponent with ball
2. Opponent making run behind line
3. Opponent between midfield and defensive line
4. Opponent free in central zone
5. Opponent on same flank

Do not assign multiple defenders to the same opponent unless the opponent has the ball in a dangerous zone.

For each dangerous opponent:

- nearest suitable defender marks
- nearby teammate covers
- another teammate blocks passing lane

Off-ball attacking logic:

When team attacks, every non-ball-carrier must choose useful movement:

Near ball:

- offer short pass
- create triangle
- overlap
- underlap
- run into half-space
- drag marker away

Medium distance:

- occupy next passing lane
- support switch
- position between lines
- hold rest defense

Far side:

- hold width
- attack back post
- prepare for switch
- tuck inside if fullback overlaps

Passing logic:

Ball carrier should not only dribble.

Every tick, ball carrier should evaluate:

1. Can shoot?
2. Is there a through pass?
3. Is there a forward pass?
4. Is there a safe support pass?
5. Is there a switch pass?
6. Should dribble into space?
7. Should hold ball?

Passing must consider:

- receiver movement
- passing lane openness
- opponent pressure
- receiver role
- distance
- direction of attack
- tactical value

Prioritize combination play:

- winger + fullback overlap
- CM + winger triangle
- ST layoff to CM
- DM switch to far side
- FB pass inside instead of always dribbling wide

Dribbling logic:

Do not always dribble straight toward role lane or sideline.

Fullback with ball:

- If near touchline, do not continue wider.
- Choose overlap only if winger is inside or passing lane is available.
- Choose underlap if winger holds width.
- Choose pass inside if pressured.
- Choose cross/cutback only in final third.
- Choose safe backward pass if trapped.

Winger with ball:

- If already wide, choose cut inside, cross, pass, or combine.
- If isolated 1v1, can dribble forward.
- If double-pressed, pass backward or inside.
- If in final third, choose cross, cutback, or shot depending on angle.
- Do not force movement to x=5 or x=95 every time.

Shooting logic:

Fix long-distance shooting.

A player can shoot only if:

- distance to goal is acceptable for role
- angle is acceptable
- there is no better pass with much higher value
- pressure is not too high
- ball is under control
- player is facing generally toward goal

Recommended max shooting distance on 0-100 pitch:

- ST: 24-28
- Winger: 20-24
- CM/CAM: 18-22
- DM/FB: 14-18
- CB: only from very close range or set pieces

Shot selection:

- If central and close: shoot
- If wide angle: prefer cross or cutback
- If far: prefer pass or dribble
- If under heavy pressure near box: quick shot allowed
- If teammate has open better chance: pass

Team shape rules:

When attacking:

- Back line should push up.
- Distance between defensive line and midfield line should stay compact.
- Distance between midfield and attack should not be too large.
- Team should not stretch vertically too much.
- Players should create passing triangles.

When defending:

- Team should compress toward ball side.
- Far-side players tuck inward.
- Back line maintains horizontal spacing.
- Midfield line protects central lanes.
- Pressing player must have cover.

Movement smoothness:

Avoid robotic coordinate snapping.

Use:

- target blending
- dead zones
- max tactical adjustment per tick
- velocity smoothing
- acceleration/braking
- curved movement
- role-specific max movement intensity

Off-ball movement should be continuous but not chaotic:

- small shape adjustment: 0.5-2 units per tick
- support movement: 2-5 units per tick
- pressing/runs: 5+ units per tick

Acceptance criteria:

After the fix:

1. When a team attacks, CBs and FBs visibly push up instead of staying near goalkeeper.
2. CM can move into opponent half.
3. DM stays behind attack but not too deep.
4. Fullbacks with ball no longer always run to the touchline.
5. Wingers with ball can cut inside, combine, cross, or shoot instead of always going wide.
6. When possession is lost, nearby players counter-press.
7. Defensive team assigns markers and covers passing lanes.
8. Off-ball players move every tick.
9. Ball carrier has multiple passing options.
10. Attack produces triangles, overlaps, underlaps, through runs, and switches.
11. ST no longer shoots from unrealistic range.
12. Shooting happens mostly near the box or from good angles.
13. The match visually feels like 11 players thinking together, not 1 player moving and 10 players watching.

Important implementation instruction:

Do not simply increase speed values.

The issue is decision logic, tactical intent, role zones, pressing assignment, and off-ball movement.

Refactor the AI decision pipeline first, then tune movement constants.

The final solution should preserve TypeScript types and keep the simulation deterministic.
