/**
 * Equipment Extraction Tests
 *
 * Tests the extractEquipmentFromMessage function for pattern matching,
 * multilingual support, and edge cases.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";

// Recreate function for testing
function extractEquipmentFromMessage(message: string): string[] {
  const equipment: string[] = [];
  const lowerMessage = message.toLowerCase();

  const equipmentPatterns: Record<string, RegExp> = {
    thermomix: /thermomix|tm[\s-]?[567]/i,
    "air fryer": /air[\s-]?fryer|freidora\s+de\s+aire/i,
    "instant pot": /instant[\s-]?pot|pressure\s*cooker|olla\s+de\s+presi[óo]n/i,
    "slow cooker": /slow[\s-]?cooker|crock[\s-]?pot|olla\s+lenta/i,
    blender: /blender|licuadora|batidora/i,
    "food processor": /food\s*processor|procesadora/i,
  };

  for (const [name, pattern] of Object.entries(equipmentPatterns)) {
    try {
      if (pattern.test(lowerMessage)) {
        equipment.push(name);
      }
    } catch (error) {
      console.warn(`[Equipment Extraction] Pattern error for ${name}:`, error);
    }
  }

  return equipment;
}

Deno.test("extractEquipmentFromMessage - Thermomix detection", () => {
  const result = extractEquipmentFromMessage("I want to use my Thermomix");
  assertEquals(result.includes("thermomix"), true);
});

Deno.test("extractEquipmentFromMessage - TM5 model detection", () => {
  const result = extractEquipmentFromMessage("Can I make this with my TM5?");
  assertEquals(result.includes("thermomix"), true);
});

Deno.test("extractEquipmentFromMessage - TM6 with hyphen", () => {
  const result = extractEquipmentFromMessage("Using my TM-6");
  assertEquals(result.includes("thermomix"), true);
});

Deno.test("extractEquipmentFromMessage - TM7 with space", () => {
  const result = extractEquipmentFromMessage("I have a TM 7");
  assertEquals(result.includes("thermomix"), true);
});

Deno.test("extractEquipmentFromMessage - air fryer (English)", () => {
  const result = extractEquipmentFromMessage("Can I use my air fryer?");
  assertEquals(result.includes("air fryer"), true);
});

Deno.test("extractEquipmentFromMessage - air fryer no space", () => {
  const result = extractEquipmentFromMessage("Using an airfryer");
  assertEquals(result.includes("air fryer"), true);
});

Deno.test("extractEquipmentFromMessage - air fryer with hyphen", () => {
  const result = extractEquipmentFromMessage("My air-fryer is ready");
  assertEquals(result.includes("air fryer"), true);
});

Deno.test("extractEquipmentFromMessage - freidora de aire (Spanish)", () => {
  const result = extractEquipmentFromMessage("Quiero usar mi freidora de aire");
  assertEquals(result.includes("air fryer"), true);
});

Deno.test("extractEquipmentFromMessage - instant pot", () => {
  const result = extractEquipmentFromMessage("I have an Instant Pot");
  assertEquals(result.includes("instant pot"), true);
});

Deno.test("extractEquipmentFromMessage - instant pot with hyphen", () => {
  const result = extractEquipmentFromMessage("Using my Instant-Pot");
  assertEquals(result.includes("instant pot"), true);
});

Deno.test("extractEquipmentFromMessage - pressure cooker", () => {
  const result = extractEquipmentFromMessage("Can I use a pressure cooker?");
  assertEquals(result.includes("instant pot"), true);
});

Deno.test("extractEquipmentFromMessage - olla de presión (Spanish)", () => {
  const result = extractEquipmentFromMessage("Tengo una olla de presión");
  assertEquals(result.includes("instant pot"), true);
});

Deno.test("extractEquipmentFromMessage - slow cooker", () => {
  const result = extractEquipmentFromMessage("Using my slow cooker");
  assertEquals(result.includes("slow cooker"), true);
});

Deno.test("extractEquipmentFromMessage - crock pot", () => {
  const result = extractEquipmentFromMessage("I have a Crock Pot");
  assertEquals(result.includes("slow cooker"), true);
});

Deno.test("extractEquipmentFromMessage - olla lenta (Spanish)", () => {
  const result = extractEquipmentFromMessage("Con mi olla lenta");
  assertEquals(result.includes("slow cooker"), true);
});

Deno.test("extractEquipmentFromMessage - blender (English)", () => {
  const result = extractEquipmentFromMessage("I need my blender");
  assertEquals(result.includes("blender"), true);
});

Deno.test("extractEquipmentFromMessage - licuadora (Spanish)", () => {
  const result = extractEquipmentFromMessage("Con una licuadora");
  assertEquals(result.includes("blender"), true);
});

Deno.test("extractEquipmentFromMessage - batidora (Spanish)", () => {
  const result = extractEquipmentFromMessage("Usando mi batidora");
  assertEquals(result.includes("blender"), true);
});

Deno.test("extractEquipmentFromMessage - food processor", () => {
  const result = extractEquipmentFromMessage("Using a food processor");
  assertEquals(result.includes("food processor"), true);
});

Deno.test("extractEquipmentFromMessage - procesadora (Spanish)", () => {
  const result = extractEquipmentFromMessage("Con una procesadora");
  assertEquals(result.includes("food processor"), true);
});

Deno.test("extractEquipmentFromMessage - multiple equipment", () => {
  const result = extractEquipmentFromMessage(
    "I have a Thermomix and an air fryer",
  );
  assertEquals(result.length, 2);
  assertEquals(result.includes("thermomix"), true);
  assertEquals(result.includes("air fryer"), true);
});

Deno.test("extractEquipmentFromMessage - case insensitive", () => {
  const result = extractEquipmentFromMessage(
    "USING MY THERMOMIX AND AIR FRYER",
  );
  assert(result.includes("thermomix"));
  assert(result.includes("air fryer"));
});

Deno.test("extractEquipmentFromMessage - no equipment mentioned", () => {
  const result = extractEquipmentFromMessage("I have chicken and rice");
  assertEquals(result.length, 0);
});

Deno.test("extractEquipmentFromMessage - empty string", () => {
  const result = extractEquipmentFromMessage("");
  assertEquals(result.length, 0);
});

Deno.test("extractEquipmentFromMessage - whitespace only", () => {
  const result = extractEquipmentFromMessage("   ");
  assertEquals(result.length, 0);
});

Deno.test("extractEquipmentFromMessage - equipment in sentence context", () => {
  const result = extractEquipmentFromMessage(
    "Make a thermomix recipe with chicken for dinner using my air fryer",
  );
  assert(result.includes("thermomix"));
  assert(result.includes("air fryer"));
});

Deno.test("extractEquipmentFromMessage - accents in Spanish", () => {
  const result = extractEquipmentFromMessage("Olla de presión");
  assert(result.includes("instant pot"));
});

Deno.test("extractEquipmentFromMessage - mixed language", () => {
  const result = extractEquipmentFromMessage("Use my Thermomix y licuadora");
  assert(result.includes("thermomix"));
  assert(result.includes("blender"));
});

Deno.test("extractEquipmentFromMessage - no duplicates", () => {
  const result = extractEquipmentFromMessage("Thermomix and Thermomix TM6");
  // Should only include thermomix once even if mentioned multiple times
  const thermomixCount = result.filter((e) => e === "thermomix").length;
  assertEquals(thermomixCount, 1);
});
