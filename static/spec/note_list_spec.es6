import "jasmine_boot"

import NoteList from "st/note_list"

describe("NoteList", function() {

  describe("matchesHead", function() {
    it("matches with singular notes", function () {
      const notes = new NoteList([
        "D5",
        "C5",
      ])

      expect(notes.matchesHead(["D5"])).toBe(true)
      expect(notes.matchesHead(["D6"])).toBe(false)
      expect(notes.matchesHead(["C5"])).toBe(false)

      // singular notes wrapped in array
      const notes2 = new NoteList([
        ["D5"],
        ["C5"],
      ])

      expect(notes2.matchesHead(["D5"])).toBe(true)
      expect(notes2.matchesHead(["C5"])).toBe(false)
    })

    it("matches with multiple notes", function () {
      const notes = new NoteList([
        ["D5", "C5"],
      ])

      expect(notes.matchesHead(["C5"])).toBe(false)
      expect(notes.matchesHead(["C5", "D5"])).toBe(true)
      expect(notes.matchesHead(["D5", "C5"])).toBe(true)
      expect(notes.matchesHead(["D6", "C5"])).toBe(false)
    })

    it("matches with singular notes, anyOctave", function () {
      const notes = new NoteList([
        "D5",
        "C5",
      ])

      expect(notes.matchesHead(["D5"], true)).toBe(true)
      expect(notes.matchesHead(["D6"], true)).toBe(true)
      expect(notes.matchesHead(["C5"], true)).toBe(false)

      // singular notes wrapped in array
      const notes2 = new NoteList([
        ["D5"],
        ["C5"],
      ])

      expect(notes2.matchesHead(["D5"], true)).toBe(true)
      expect(notes2.matchesHead(["D6"], true)).toBe(true)
      expect(notes2.matchesHead(["C5"], true)).toBe(false)
    })


  })
})
