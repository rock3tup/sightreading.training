
// Read this for refresher on terminology: https://en.wikipedia.org/wiki/Staff_(music)

import * as React from "react"
import classNames from "classnames"
import * as types from "prop-types"

import Two from "two.js"

const STAFF_HEIGHT_OFFSET = -100
const STAFF_INNER_HEIGHT = 236

// These dimensions are in "Staff local" coordinates
const BAR_WIDTH = 12
const LEDGER_HEIGHT = 4
const LEDGER_DY = 58
const CLEF_GAP = 28 // the X spacing between cleff and first note
const NOTE_GAP = 100 // the X spacing between notes
const NOTE_HALF_HEIGHT = 29 // the Y spacing between notes

import {CLEF_G, CLEF_F, FLAT, SHARP, QUARTER_NOTE, WHOLE_NOTE} from "st/staff_assets"

import {parseNote, noteStaffOffset, MIDDLE_C_PITCH} from "st/music"

import NoteList from "st/note_list"

const createAsset = function(element, name) {
  let out = React.memo(React.forwardRef((_, ref) =>
    // NOTE: nulling out viewBox is a hack to deal with this bug: https://github.com/jonobr1/two.js/issues/561
    React.cloneElement(element, { ref, viewBox: null })
  ))

  if (name) {
    out.displayName = name
  }
  return out
}

// we wrap in components so we can fetch them by reference
const GClef = createAsset(CLEF_G, "GClef")
const FClef = createAsset(CLEF_F, "FClef")
const Flat = createAsset(FLAT, "Flat")
const Sharp = createAsset(SHARP, "Sharp")
const QuarterNote = createAsset(QUARTER_NOTE, "QuarterNote")
const WholeNote = createAsset(WHOLE_NOTE, "WholeNote")

// manages a Two.Group for a single staff, clef and including key signature
// all cordinates are done in "staff local" space, STAFF_HEIGHT_OFFSET
// The staff contains a "notes group" which contains all the notes rendered by the staff
class StaffGroup {
  constructor(params={}) {
    this.getAsset = params.getAsset
    this.clef = params.clef || "g"
    this.keySignature = params.keySignature || 0
    this.width = params.width || 1000
  }

  // resize the staff to a new width
  updateWidth(width) {
    this.width = width
    if (this.lines) {
      for (let line of this.lines) {
        line.vertices[1].x = this.width
        line.vertices[2].x = this.width
      }
    }
  }

  // creates a two.group for the staff, but not containing any notes. Ledger lines are inserted by the notes group
  render() {
    this.renderGroup = new Two.Group()

    // the X location where the notes can be rendered from. This will be
    // incremented by initial bar line, key signature, time signature, etc.
    this.marginX = 0

    let bar = this.makeBar(0, 0, BAR_WIDTH, STAFF_INNER_HEIGHT)
    this.renderGroup.add(bar)
    this.marginX += BAR_WIDTH

    this.lines ||= []
    for (let i = 0; i < 5; i++) {
      let line = this.makeBar(this.marginX, i*LEDGER_DY, this.width - this.marginX, LEDGER_HEIGHT)
      this.renderGroup.add(line)
      this.lines.push(line)
    }

    if (this.clef == "g") {
      const clef = this.getAsset("gclef")
      this.renderGroup.add(clef)
      this.marginX += CLEF_GAP
      clef.translation.set(this.marginX, STAFF_HEIGHT_OFFSET + 14)
      this.marginX += clef.getBoundingClientRect().width
    } else if (this.clef == "f") {
      const clef = this.getAsset("fclef")

      this.renderGroup.add(clef)
      this.marginX += CLEF_GAP
      clef.translation.set(this.marginX, STAFF_HEIGHT_OFFSET + 102)
      this.marginX += clef.getBoundingClientRect().width
    }

    let keySignature
    if (this.keySignature > 0) { // sharp
      keySignature = this.makeKeySignature("sharp", this.keySignature)
    } else if (this.keySignature < 0) { // flat
      keySignature = this.makeKeySignature("flat", -this.keySignature)
    }

    if (keySignature) {
      this.marginX += CLEF_GAP
      keySignature.translation.set(this.marginX, 0)
      this.renderGroup.add(keySignature)
      this.marginX += keySignature.getBoundingClientRect().width
    }

    return this.renderGroup
  }

  // convet list of notes into group of positioned note shapes
  makeNotes(notes) {
    const notesGroup = new Two.Group()
    notesGroup.translation.set(this.marginX, 0)

    let nextNoteX = CLEF_GAP * 2 // the x position of the next rendred note

    const noteAsset = this.getAsset("wholeNote")
    const noteAssetWidth = noteAsset.getBoundingClientRect().width

    // the default Y (0) location is the top-most space within the staff

    // console.log("refresh notes", this.props.notes)
    for (let noteColumn of notes) {
      for (let note of noteColumn) {
        let value = parseNote(note)
        let n = noteAsset.clone()

        n.translation.set(nextNoteX, this.getNoteY(note))
        notesGroup.add(n)
      }

      nextNoteX += noteAssetWidth + NOTE_GAP
    }

    return notesGroup
  }

  // renders new set of notes into the primary note group. Note that the staff
  // must be rendered first to have the render group available
  renderNotes(notes) {
    // remove existing notes if they are there
    if (this.notesGroup) {
      this.notesGroup.remove()
      delete this.notesGroup
    }

    this.notesGroup = this.makeNotes(notes)
    this.notesGroup.addTo(this.renderGroup)
  }

  // keep in mind held notes is not array of note names but table
  renderHeldNotes(heldNotes) {
    if (this.heldNotesGroup) {
      this.heldNotesGroup.remove()
      delete this.heldNotesGroup
    }

    const notes = new NoteList([Object.keys(heldNotes)])

    this.heldNotesGroup = this.makeNotes(notes)
    this.heldNotesGroup.opacity = 0.25
    this.heldNotesGroup.addTo(this.renderGroup)
  }

  makeKeySignature(type, count) {
    let offsets, accidentalAsset

    // these offsets apply to G clef with default staff height offset
    if (type == "flat") {
      offsets = [133, 42, 158, 67, 191, 100, 216]
      accidentalAsset = this.getAsset("flat")
    } else if (type == "sharp") {
      offsets = [42, 129, 14, 101, 187, 71, 158]
      accidentalAsset = this.getAsset("sharp")
    } else {
      throw new Error("Unknown type for makeKeySignature: " + type)
    }

    let group = new Two.Group()

    let offsetX = 0
    const accidentalGap = 4
    for (var k = 0; k < count; k++) {
      let a = accidentalAsset.clone()
      a.translation.set(offsetX, offsets[k] + STAFF_HEIGHT_OFFSET)
      offsetX += a.getBoundingClientRect().width + accidentalGap
      group.add(a)
    }

    return group
  }


  // makes a rectangle with the origin on the top left
  makeBar(x,y,w,h) {
    let bar = new Two.Path([
      new Two.Anchor(x, y),
      new Two.Anchor(x + w, y),
      new Two.Anchor(x + w, y + h),
      new Two.Anchor(x, y + h)
    ], true, false)

    bar.fill = "black"
    bar.noStroke()

    return bar
  }

  // notes group pre-offset group that will contain all notes & bars on this staff
  getNotesGroup() {
    return this.notesGroup
  }

  getRenderGroup() {
    return this.renderGroup
  }

  getMarginX() {
    return this.marginX
  }

  // the note Y position offset based on the cleff of the staff
  getCleffNoteOffset() {
    if (this.clef == "g") {
      return 44
    } else if (this.clef == "f") {
      return 32
    }

    throw new Error(`Don't know how to position notes for cleff: ${this.cleff}`)
  }

  // calculate the note Y offset depending on the note name
  getNoteY(note) {
    return (-noteStaffOffset(note) + this.getCleffNoteOffset()) * NOTE_HALF_HEIGHT
  }
}

export class StaffTwo extends React.PureComponent {
  // TODO: grand should probably be handled differently -- we want it to be a
  // controller that renders both and then feeds the correct voices to the
  // correct staves
  static propTypes = {
    type: types.oneOf(["treble", "bass", "grand"])
  }

  constructor(props) {
    super()
    this.state = {}

    this.containerRef = React.createRef()
    this.assetsRef = React.createRef()

    this.assets = { } // this will be populated with asset refs when they are fist instantiated
  }

  createResizeObserver() {
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        this.updateWidth(entry.contentRect.width)
      }
    })

    this.resizeObserver.observe(this.containerRef.current)
  }

  componentWillUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      delete this.resizeObserver
    }

    // clean up the the two.js instance
    this.two.unbind("update")
    this.two.pause()
    this.containerRef.current.removeChild(this.two.renderer.domElement)
    delete this.two
  }

  updateWidth(width, force=false) {
    if (force || (this.two && width != this.two.width)) {
      // setting dimensions is funky: https://github.com/jonobr1/two.js/issues/191
      this.two.width = width

      // scale to staff local space
      let scaledWidth = this.two.width / this.renderGroup.scale

      if (this.staves) {
        for (let staff of this.staves) {
          staff.updateWidth(scaledWidth)
        }
      }

      this.two.renderer.setSize(this.two.width, this.two.height)
      this.two.update()
    }
  }

  componentDidMount() {
    this.createResizeObserver()
    let initialWidth = this.containerRef.current.getBoundingClientRect().width

    this.two = new Two({
      width: initialWidth,
      height: 300,
      // type: Two.Types.canvas
    }).appendTo(this.containerRef.current)

    // render group contains the final viewport transformation
    this.renderGroup = this.two.makeGroup()
    this.renderGroup.scale = 0.5

    this.refreshStaves()
    this.refreshNotes()

    this.scaleToFit()
    this.two.update()
  }

  // this is a quick hack for development: we should really be using the note
  // range to control the scale to prevent jumping around in size as new notes
  // are generated
  scaleToFit(maxScale=0.5) {
    const targetHeight = this.two.height
    const origScale = this.renderGroup.scale

    this.renderGroup.scale = 1
    this.renderGroup.translation.set(0,0)

    // we want to map these coordinates to the output height
    let {top, bottom} = this.renderGroup.getBoundingClientRect()

    // add some padding
    top = Math.min(top, -1)
    bottom += 10

    const sourceHeight = bottom - top
    const scale = Math.min(maxScale, targetHeight / sourceHeight)

    this.renderGroup.scale = scale
    this.renderGroup.translation.set(0, Math.floor(-(top * scale)))

    if (scale != origScale) {
      // force update call to width since scale has changed
      this.updateWidth(this.two.width, true)
      return true
    }

    return false
  }

  refreshStaves() {
    if (this.stavesGroup) {
      this.stavesGroup.remove()
    }

    this.stavesGroup = new Two.Group()
    this.stavesGroup.translation.set(0, -STAFF_HEIGHT_OFFSET)
    this.stavesGroup.addTo(this.renderGroup)

    this.staves = []

    if (this.props.type == "treble" || this.props.type == "grand") {
      this.addStaff(new StaffGroup({
        getAsset: this.getAsset.bind(this),
        clef: "g",
        keySignature: this.props.keySignature.getCount(),
        width: this.two.width / this.renderGroup.scale
      }))
    }

    if (this.props.type == "bass" || this.props.type == "grand") {
      this.addStaff(new StaffGroup({
        getAsset: this.getAsset.bind(this),
        clef: "f",
        keySignature: this.props.keySignature.getCount(),
        width: this.two.width / this.renderGroup.scale
      }))
    }
  }

  // this will update all the visible notes
  refreshNotes() {
    if (this.props.notes) {
      this.staves[0].renderNotes(this.props.notes)
    }

    if (this.props.heldNotes) {
      this.staves[0].renderHeldNotes(this.props.heldNotes)
    }
  }

  // add StaffGroup to list of staves managed by this component
  addStaff(staffGroup) {
    const STAFF_ALIGN = 500

    this.staves ||= []
    this.staves.push(staffGroup)

    staffGroup.render()
      .addTo(this.stavesGroup)
      .translation.set(0, (this.staves.length - 1) * STAFF_ALIGN)
  }

  getAsset(name) {
    const domNode = this.assets[name].current

    if (!domNode) {
      throw new Error("Failed to find asset by name: " + name)
    }

    const asset = this.two.interpret(domNode)
    asset.remove() // remove it from default scene
    return asset
  }

  // NOTE: flushChanges is set by the prop watchers in the rendered contents of
  // this widget. componentDidUpdate is called after all children have
  // rendered, so we can use it to apply the updates to the scene graph to the
  // output
  componentDidUpdate(prevProps, prevState) {
    if (this.flushChanges) {
      this.flushChanges = false
      this.scaleToFit()
      this.two.update()
    }
  }

  render() {
    this.RefreshNotes ||= Object.assign(React.memo((props) => {
      if (this.renderGroup) {
        this.refreshNotes()
        this.flushChanges = true
      }
      return null
    }), {
      displayName: "RefreshNotes"
    })

    this.RefreshStaves ||= Object.assign(React.memo((props) => {
      if (this.renderGroup) {
        this.refreshStaves()
        this.flushChanges = true
      }
      return null
    }), { displayName: "RefreshStaves" })

    return <div className="notes_staff" ref={this.containerRef}>
      <this.RefreshNotes
        notes={this.props.notes}
        heldNotes={this.props.heldNotes}
      />

      <this.RefreshStaves
        type={this.props.type}
        keySignature={this.props.keySignature}
      />

      <div ref={this.assetsRef} className="assets" style={{display: "none"}}>
        <GClef ref={this.assets.gclef ||= React.createRef()} />
        <FClef ref={this.assets.fclef ||= React.createRef()} />
        <Flat ref={this.assets.flat ||= React.createRef()} />
        <Sharp ref={this.assets.sharp ||= React.createRef()} />
        <WholeNote ref={this.assets.wholeNote ||= React.createRef()} />
        <QuarterNote ref={this.assets.quarterNote ||= React.createRef()} />
      </div>
    </div>
  }
}
