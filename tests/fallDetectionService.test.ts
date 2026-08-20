import assert from 'assert';

function calculateMagnitude(x: number, y: number, z: number): number {
    return Math.sqrt(x * x + y * y + z * z);
}

function evaluateFallCondition(
    magnitude: number,
    isFreeFall: boolean,
    freeFallTimestamp: number,
    now: number,
    lowThreshold: number = 0.35,
    highThreshold: number = 3.5,
    extremeImpactThreshold: number = 5.0
): { isFall: boolean; isFreeFall: boolean; freeFallTimestamp: number } {
    if (magnitude < lowThreshold) {
        return { isFall: false, isFreeFall: true, freeFallTimestamp: now };
    }

    let activeFreeFall = isFreeFall;
    if (activeFreeFall && now - freeFallTimestamp > 1500) {
        activeFreeFall = false;
    }

    if (magnitude > highThreshold) {
        if (activeFreeFall || magnitude >= extremeImpactThreshold) {
            return { isFall: true, isFreeFall: false, freeFallTimestamp: 0 };
        }
    }

    return { isFall: false, isFreeFall: activeFreeFall, freeFallTimestamp };
}

async function runTests() {
    console.log('--- Testing Updated Fall Detection Thresholds ---');

    const restMag = calculateMagnitude(0, 0, 1.0);
    assert.strictEqual(restMag, 1.0, 'Resting magnitude should be 1.0g');

    // 1. Shaking without drop should NOT trigger a fall (e.g., 2.8g)
    const shakeRes = evaluateFallCondition(2.8, false, 0, 1000);
    assert.strictEqual(shakeRes.isFall, false, 'Manual device shaking should not trigger fall alert');

    // 2. Free-fall drop followed by impact spike
    const dropRes = evaluateFallCondition(0.2, false, 0, 1000);
    assert.strictEqual(dropRes.isFreeFall, true, 'Low G reading should trigger free-fall state');
    assert.strictEqual(dropRes.isFall, false, 'Free-fall drop alone should not trigger fall alert');

    const impactRes = evaluateFallCondition(3.6, dropRes.isFreeFall, dropRes.freeFallTimestamp, 1200);
    assert.strictEqual(impactRes.isFall, true, 'High impact after free-fall should trigger fall alert');

    // 3. Extreme collision spike (>= 5.0g) without freefall
    const extremeImpact = evaluateFallCondition(5.2, false, 0, 1000);
    assert.strictEqual(extremeImpact.isFall, true, 'Extreme impact peak should trigger fall alert');

    console.log('✅ All updated Fall Detection unit tests passed!');
}

runTests().catch(err => {
    console.error('❌ Fall Detection test failed:', err);
    process.exit(1);
});
