import * as React from "react"
import {classNames, MersenneTwister} from "lib"

import NoteList from "st/note_list"

import Slider from "st/components/slider"
import Select from "st/components/select"

import {parseMidiMessage} from "st/midi"
import {setTitle} from "st/globals"
import {MajorScale, parseNote} from "st/music"
import {RandomNotes} from "st/generators"
import {STAVES} from "st/data"

import * as types from "prop-types"
import {TransitionGroup, CSSTransition} from "react-transition-group"

import Keyboard from "st/components/keyboard"
import MidiButton from "st/components/midi_button"

import {dispatch, trigger} from "st/events"

class MelodyRecognitionExercise extends React.Component {
  static exerciseName = "Melody Recognition"
  static exerciseId = "melody_recognition"

  render() {
    return <div className="melody_recognition">
      <div className="page_container">
        <h2>Hi</h2>
      </div>
    </div>
  }
}

class MelodyPlaybackExercise extends React.Component {
  static exerciseName = "Melody Playback"
  static exerciseId = "melody_playback"

  static ROOTS = [
    "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"
  ]

  constructor(props) {
    super(props)
    this.setNotesPerMelody = value => this.setState({ notesPerMelody: value })

    this.state = {
      noteHistory: new NoteList([]),
      touchedNotes: {},
      keyboardHeldNotes: {},
      notesPerMelody: 3,
      notesPerColumn: 1,
      continuousMelody: false,

      melodyRange: ["C4", "C6"],
      meldoyScaleRoot: "random",

      rand: new MersenneTwister(),
      successes: 0,
    }

    this.keyboardPressNote = this.keyboardPressNote.bind(this)
    this.keyboardReleaseNote = this.keyboardReleaseNote.bind(this)
  }

  midiOutputs() {
    if (!this.props.midi) return []
    return [...this.props.midi.outputs.values()]
  }

  onMidiMessage(message) {
    let parsed = parseMidiMessage(message)

    if (!parsed) { return }

    let [e, note] = parsed

    if (e == "dataEntry") {
      if (!this.state.playing) {
        // use the pitch wheel to trigger new melody or replay
        if (this.state.currentNotes) {
          this.playMelody()
        } else {
          this.pushMelody()
        }
      }
    }

    if (e == "noteOn") {
      this.pressNote(note)
    }

    if (e == "noteOff") {
      this.releaseNote(note)
    }
  }


  // see if the pressed notes buffer matches the melody
  checkForMatch() {
    if (!this.state.currentNotes || !this.state.noteHistory) {
      return
    }

    if (this.state.noteHistory.length < this.state.currentNotes.length) {
      return
    }

    while (this.state.noteHistory.length > this.state.currentNotes.length) {
      this.state.noteHistory.shift()
    }

    if (this.state.noteHistory.toString() == this.state.currentNotes.toString()) {
      this.setState({
        noteHistory: new NoteList([]),
        locked: true,
        successes: this.state.successes + 1,
        statusMessage: "You got it"
      })

      setTimeout(() => {
        this.setState({
          locked: false,
          statusMessage: null
        })
        this.pushMelody()
      }, 1000)
    }
  }

  playMelody(notes=this.state.currentNotes) {
    // need to add cancel
    if (this.state.playing) {
      console.warn("aborting playing, something is already playing")
      return
    }

    this.setState({ playing: true })
    this.props.midiOutput.playNoteList(notes).then(() => {
      this.setState({ playing: false })
    })
  }

  pushMelody() {
    let scaleRoot = null

    if (this.state.meldoyScaleRoot == "random") {
      scaleRoot = MelodyPlaybackExercise.ROOTS[this.state.rand.int() % MelodyPlaybackExercise.ROOTS.length]
    } else {
      scaleRoot = this.state.meldoyScaleRoot
    }

    let notes = new MajorScale(scaleRoot).getLooseRange(...this.state.melodyRange)

    let generator
    if (this.state.continuousMelody && this.currentNotes) {
      // reuse the same generator so the melody is smooth
      generator = this.state.currentNotes.generator
      generator.notes = notes // replace notes with the new set generated
      generator.notesPerColumn = this.state.notesPerColumn
    } else {
      generator = new RandomNotes(notes, {
        smoothness: 6,
        notes: this.state.notesPerColumn,
        hands: 1,
      })
    }

    // create a test melody
    let list = new NoteList([], { generator })
    list.fillBuffer(this.state.notesPerMelody)

    this.props.midiOutput.playNoteList(list).then(() => {
      this.setState({ playing: false })
    })

    this.setState({
      playing: true,
      currentNotes: list
    })
  }

  render() {
    let locked = this.state.playing || this.state.locked || false

    let repeatButton
    if (this.state.currentNotes) {
      repeatButton = <button disabled={locked} onClick={(e) => {
        e.preventDefault()
        this.playMelody()
      }}>Repeat melody</button>
    }

    let ranges = [
      {
        name: "singing",
        range: ["C4", "C6"]
      },
      ...STAVES.filter(s => s.mode == "notes")
    ]

    let instructions
    if (this.state.showInstructions) {
      instructions = <p>Click <em>New melody</em> to generate a random melody, then play it
        back using the onscreen keyboard or your MIDI input device. You'll be given
        a new melody after figuring out what you heard. You can trigger current the
        melody to replay by interacting with any of the sliders or pedals on your
        MIDI controller.</p>
    } else {
      instructions = <p>
        <a href="javascript:void(0)" onClick={e => {
          e.preventDefault()
          this.setState({ showInstructions: true })
        }}>Show instructions...</a>
      </p>
    }


    let page = <div className="page_container">
      {instructions}
      <div className="stat_controls">
        {repeatButton}
        <button disabled={locked} onClick={(e) => {
          e.preventDefault()
          this.pushMelody()
        }}>New melody</button>
        <span>{this.state.statusMessage}</span>

        <div className="stats_row">
          <div className="stat_container">
            <div className="value">{this.state.successes}</div>
            <div className="label">Melodies</div>
          </div>
        </div>
      </div>

      <fieldset>
        <legend>Notes per melody</legend>
        <Slider
          min={2}
          max={8}
          onChange={this.setNotesPerMelody}
          value={this.state.notesPerMelody} />
        <span>{this.state.notesPerMelody}</span>

        <span className="spacer"></span>

        <label>
          <input
            type="checkbox"
            checked={this.state.continuousMelody}
            onChange={e => {
              this.setState({continuousMelody: e.target.checked})
            }} />

          <span className="label">Continuous melody</span>
        </label>

      </fieldset>

      <fieldset>
        <legend>Notes per column</legend>
        <Slider
          min={1}
          max={4}
          onChange={(value) => {
            this.setState({ notesPerColumn: value })
          }}
          value={this.state.notesPerColumn} />
        <span>{this.state.notesPerColumn}</span>
      </fieldset>

      <fieldset className="range_picker">
        <legend>Range</legend>
        {ranges.map(r => {
          return <button
            className={classNames({
              active: r.range.join(",") == this.state.melodyRange.join(",")
            })}
            onClick={e => {
              e.preventDefault();
              this.setState({
                melodyRange: r.range
              })
            }}
            key={r.name}>{r.name}</button>
        })}
      </fieldset>

      <fieldset>
        <legend>Scale</legend>
        {this.renderScalePicker()}
      </fieldset>
    </div>

    return <div className="melody_playback_exercise keyboard_open">
      <div className="workspace">
        {page}
      </div>
      {this.renderKeyboard()}
    </div>
  }

  renderScalePicker() {
    if (!this.props.midi) {
      return;
    }

    return <label>
      <Select
        value={this.state.meldoyScaleRoot}
        onChange={(val) => this.setState({ meldoyScaleRoot: val})}
        options={[
          { name: "Random", value: "random"},
          ...MelodyPlaybackExercise.ROOTS.map((r) => ({ name: `${r} major`, value: r }))
        ]}/>
    </label>
  }

  keyboardPressNote(note) {
    if (this.props.midiOutput) {
      this.props.midiOutput.noteOn(parseNote(note), 100)
    }

    this.pressNote(note)
  }

  keyboardReleaseNote(note) {
    if (this.props.midiOutput) {
      this.props.midiOutput.noteOff(parseNote(note))
    }

    this.releaseNote(note)
  }

  pressNote(note) {
    this.setState({
      keyboardHeldNotes: {
        ...this.state.keyboardHeldNotes,
        [note]: true
      }
    })

    this.pressedNotes = this.pressedNotes || {}

    let newColumn = Object.keys(this.pressedNotes) == 0

    if (newColumn) {
      this.state.noteHistory.push([note])
    } else {
      this.state.noteHistory[this.state.noteHistory.length - 1].push(note)
    }

    this.pressedNotes[note] = this.pressedNotes[note] || 0
    this.pressedNotes[note] += 1
  }

  releaseNote(note) {
      if (!this.pressedNotes) { return }
      if (!this.pressedNotes[note]) { return }
      this.pressedNotes[note] -= 1

      if (this.pressedNotes[note] < 1) {
        delete this.pressedNotes[note]
      }

      if (Object.keys(this.pressedNotes).length == 0) {
        this.checkForMatch()
      }

    this.setState({
      keyboardHeldNotes: {
        ...this.state.keyboardHeldNotes,
        [note]: false
      }
    })
  }

  renderKeyboard() {
    return <Keyboard
      lower={this.state.melodyRange[0]}
      upper={this.state.melodyRange[1]}
      heldNotes={this.state.keyboardHeldNotes}
      onKeyDown={this.keyboardPressNote}
      onKeyUp={this.keyboardReleaseNote} />
  }
}

class SettingsPanel extends React.PureComponent {
  static propTypes = {
    close: types.func,
    // not settings yet
    // updateSettings: types.func.isRequired,
    // currentExerciseSettings: types.object.isRequired,
    exercises: types.array.isRequired,
    setExercise: types.func.isRequired,
    currentExercise: types.func.isRequired, // class
  }

  render() {
    const current = this.props.currentExercise

    return <section className="settings_panel">
      <div className="settings_header">
        <button onClick={this.props.close}>Close</button>
        <h3>Settings</h3>
      </div>

      <section className="settings_group">
        <Select
          name="exercise"
          className="exercise_selector"
          value={current ? current.exerciseId : null}
          onChange={this.props.setExercise}
          options={this.props.exercises.map(e => ({
            name: e.exerciseName,
            value: e.exerciseId
          }))}/>
      </section>
    </section>
  }
}

export default class EarTrainingPage extends React.Component {
  componentDidMount() {
    setTitle("Ear Training")
  }

  constructor(props) {
    super(props)

    this.exercises = [
      MelodyPlaybackExercise,
      MelodyRecognitionExercise
    ]

    this.state = {
      settingsPanelOpen: false,
      currentExerciseIdx: 0,
    }

    this.setExercise = this.setExercise.bind(this)
    this.closeSettingsPanel = () => this.setState({ settingsPanelOpen: false })
  }

  setExercise(exerciseName) {
    let exercise = this.exercises.find(e => e.exerciseId == exerciseName)

    if (!exercise) {
      // try by id
      exercise = this.exercises[exerciseName]
    }

    if (!exercise) {
      throw new Error(`Invalid exercise ${exerciseName}`)
    }

    let idx = this.exercises.indexOf(exercise)

    this.setState({
      currentExerciseIdx: idx,
    })
  }

  onMidiMessage(message) {
    if (this.currentExercise) {
      this.currentExercise.onMidiMessage(message)
    }
  }

  render() {
    let contents
    if (this.props.midiOutput) {
      contents = this.renderExercise()
    } else {
      contents = this.renderIntro()
    }

    let Exercise = this.exercises[this.state.currentExerciseIdx]

    let header = 
      <div className="exercise_header">
        <div className="exercise_label">{Exercise ? Exercise.exerciseName : ""}</div>
        <button
          onClick={e => this.setState({
            settingsPanelOpen: !this.state.settingsPanelOpen
          })}
          type="button">Choose Exercise</button>
      </div>

    return <div className="ear_training_page">
      {this.props.midiOutput ? header : null}
      {contents}
      <TransitionGroup>
        {this.renderSettings()}
      </TransitionGroup>
    </div>
  }

  renderSettings() {
    if (!this.state.settingsPanelOpen) {
      return
    }

    let Exercise = this.exercises[this.state.currentExerciseIdx]

    return <CSSTransition classNames="slide_right" timeout={{enter: 200, exit: 100}}>
      <SettingsPanel
        close={this.closeSettingsPanel}
        setExercise={this.setExercise}
        exercises={this.exercises}
        currentExercise={Exercise}
      />
    </CSSTransition>
  }

  renderExercise() {
    let Exercise = this.exercises[this.state.currentExerciseIdx]

    return <Exercise
      ref={(e) => this.currentExercise = e}
      midi={this.props.midi}
      midiOutput={this.props.midiOutput}
      midiInput={this.props.midiInput}
      />
  }

  renderIntro() {
    if (!this.props.midi) {
      return <div className="page_container choose_device">
        <strong>No MIDI support detected in your browser, ensure you're using Chrome</strong>
      </div>
    }

    return <div className="page_container choose_device">
      <h3>Choose a MIDI output device for ear training</h3>
      <p>The ear training tools require a MIDI output device in order to play notes. Select your MIDI devices:</p>


      <MidiButton
        midiInput={this.props.midiOutput}
        pickMidi={() => {
          trigger(this, "pickMidi")
        }} />
    </div>
  }
}
