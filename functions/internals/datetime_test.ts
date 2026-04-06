import { assertEquals, assertInstanceOf } from "@std/assert";
import { calcElapsedRate, getJstToday, renderBar, round1 } from "./datetime.ts";

// ----- round1 -----

Deno.test("round1: 小数第1位に丸める", () => {
  assertEquals(round1(1.15), 1.2);
  assertEquals(round1(1.14), 1.1);
  assertEquals(round1(2.05), 2.1);
});

Deno.test("round1: 整数はそのまま", () => {
  assertEquals(round1(5), 5);
  assertEquals(round1(0), 0);
});

Deno.test("round1: 負の値", () => {
  assertEquals(round1(-1.15), -1.1);
  assertEquals(round1(-3.78), -3.8);
});

// ----- renderBar -----

Deno.test("renderBar: 0%", () => {
  assertEquals(renderBar(0), "░░░░░░░░░░");
});

Deno.test("renderBar: 100%", () => {
  assertEquals(renderBar(100), "██████████");
});

Deno.test("renderBar: 50%", () => {
  assertEquals(renderBar(50), "█████░░░░░");
});

Deno.test("renderBar: totalを指定", () => {
  assertEquals(renderBar(50, 5), "███░░");
  assertEquals(renderBar(0, 5), "░░░░░");
  assertEquals(renderBar(100, 5), "█████");
});

// ----- getJstToday -----

Deno.test("getJstToday: Dateオブジェクトを返す", () => {
  const today = getJstToday();
  assertInstanceOf(today, Date);
});

Deno.test("getJstToday: 時刻が0:00:00", () => {
  const today = getJstToday();
  assertEquals(today.getHours(), 0);
  assertEquals(today.getMinutes(), 0);
  assertEquals(today.getSeconds(), 0);
  assertEquals(today.getMilliseconds(), 0);
});

// ----- calcElapsedRate -----

Deno.test("calcElapsedRate: 十分に未来の学期は0を返す", () => {
  assertEquals(calcElapsedRate("2099-01-01", "2099-12-31"), 0);
});

Deno.test("calcElapsedRate: 十分に過去の学期は100を返す", () => {
  assertEquals(calcElapsedRate("2000-01-01", "2000-12-31"), 100);
});

Deno.test("calcElapsedRate: 期間が0以下の場合は100を返す", () => {
  assertEquals(calcElapsedRate("2024-06-01", "2024-06-01"), 100);
  assertEquals(calcElapsedRate("2024-06-30", "2024-06-01"), 100);
});

Deno.test("calcElapsedRate: 結果は0〜100の範囲", () => {
  const rate = calcElapsedRate("2020-01-01", "2099-12-31");
  assertEquals(rate >= 0 && rate <= 100, true);
});
