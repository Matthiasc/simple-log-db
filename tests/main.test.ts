import { test, expect, beforeAll } from "vitest";
import { LogDB, SimpleLogDB } from "../src";

import { readdir } from "fs/promises";

let db: LogDB<any>;

beforeAll(() => {
  db = SimpleLogDB('./tests/test.log', {
    maxFileSize: 1024,
    maxFileCount: 3,
    addTimestamp: true,
    rotationEnabled: true,
  })
});
// Clean up the test log file before running tests

test("to be defined", () => {
  expect(db).toBeDefined();
})

test("add and read a line", async () => {
  await db.add({ name: "test", value: 123 })
  await db.last(1).then((lines: any) => {
    expect(lines.length).toBe(1);
    expect(lines[0].name).toBe("test");
    expect(lines[0].value).toBe(123);
  })
});

test("clear log file", async () => {
  await db.clear();
  await db.last(1).then((lines: any) => {
    expect(lines.length).toBe(0);
  })
});

test("add multiple entries and read multiple lines", async () => {
  await db.add([{ name: "test1", value: 123 }, { name: "test2", value: 123 },])
  await db.last(2).then((lines: any) => {
    expect(lines.length).toBe(2);
    expect(lines[0].name).toBe("test1");
    expect(lines[0].value).toBe(123);
    expect(lines[1].name).toBe("test2");
    expect(lines[1].value).toBe(123);
  })
});

test("create rolling files", async () => {

  const dbRol = SimpleLogDB('./tests/test_rol.log', {
    maxFileSize: 1024,
    maxFileCount: 3,
  });

  for (let i = 0; i < 100; i++) {
    await dbRol.add({ name: "test" + i, value: i })
  }

  // find all files in the directory
  const dir = './';
  const files = await readdir(dir);
  const logFiles = files.filter(file => file.startsWith('test_rol') && file.endsWith('.log'));
  console.log("logFiles", logFiles);
  expect(logFiles.length).toBe(3);

});


