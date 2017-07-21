'use babel';

import package from '../package.json'
import {BufferedProcess} from 'atom'
import fs from 'fs'

function asyncTimeout(value, timeout) {
  return new Promise(resolve => setTimeout(() => resolve(value), timeout))
}

function syncExists(path) {
  try {
    fs.statSync(path)
  } catch(e) {
    if (e.code === 'ENOENT') {
      return false
    }
  }

  return true
}

export default class GulpRunnerView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div')
    this.element.classList.add('gulp-runner')

    const padded = document.createElement('div')
    padded.className = 'padded'

    this.block = document.createElement('div')
    this.block.className = 'btn-group'

    this.taskButtons = []

    padded.appendChild(this.block)

    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
      this.element.appendChild(padded)
    })

    this.bindedTaskButtonClickHandler = this.taskButtonClickHandler.bind(this)
    this.bindedExitHandler = this.exitHandler.bind(this)
    this.bindedUpdateTaskButtons = this.updateTaskButtons.bind(this)
    this.bindedGetTaskList = this.getTaskList.bind(this)

    this.projectPaths = atom.project.getPaths()
    this.processOptions = {
      cwd: `${this.projectPaths[0]}/`
    }

    this.updateTasks()

    this.lastTaskProcess = false
    this.lastTaskName = false
  }

  localGulpExists() {
    return syncExists(`${this.projectPaths[0]}/node_modules/.bin/gulp`)
  }
  
  renderMessage(message) {
    const noGulpMessage = document.createElement('div')
    noGulpMessage.appendChild(document.createTextNode(message))

    this.removeButtons()
    this.block.appendChild(noGulpMessage)
  }

  updateTasks() {
    if (!this.localGulpExists()) {
      this.renderMessage('Local gulp not found')
    } else {
      this.bindedGetTaskList()
      .catch(error => {
        if (error.code === 127) {
          return asyncTimeout(null, 3000)
        }

        return Promise.reject(error)
      })
      .then(this.bindedGetTaskList)
      .then(this.bindedUpdateTaskButtons)
      .catch(error => {
        if (error.code === 1 && !error.message.length) {
          atom.notifications.addError('No gulpfile found')
          this.renderMessage('No gulpfile found')
        } else {
          atom.notifications.addError(error.message, {dismissable: true})
        }
      })
    }
  }

  removeButtons() {
    this.taskButtons.forEach(button => {
      button.removeEventListener('click', this.bindedTaskButtonClickHandler)
    })

    while (this.block.childNodes.length) {
      this.block.childNodes[0].parentNode.removeChild(this.block.childNodes[0])
    }
  }

  prepareTaskLabel(task) {
    return task.split(/[\-_]/)
    .map(word => word.substr(0, 1).toUpperCase() + word.substr(1))
    .join(' ')
  }

  updateTaskButtons(tasks) {
    this.removeButtons()

    this.taskButtons.splice(0, this.taskButtons.length)

    tasks.forEach(task => {
      const taskButton = document.createElement('button')
      taskButton.className = 'btn'
      taskButton.setAttribute('data-task', task)
      taskButton.appendChild(document.createTextNode(this.prepareTaskLabel(task)))

      this.block.appendChild(taskButton)

      this.taskButtons.push(taskButton)

      taskButton.addEventListener('click', this.bindedTaskButtonClickHandler)
    })
  }

  getTaskList() {
    return new Promise((resolve, reject) => {
      let errorMessage = ''

      const process = new BufferedProcess({
        command: './node_modules/.bin/gulp',
        args: ['--tasks-simple', '--cwd'],
        stdout: output => resolve(output.split(/\s/g).filter(file => file.length)),
        stderr: output => errorMessage += output,
        exit: code => reject({code, message: errorMessage}),
        options: this.processOptions
      })
    })
  }

  exitHandler(code = -1) {
    this.lastTaskProcess = false

    if (this.lastTaskName !== false) {
      this.element.querySelector(`[data-task="${this.lastTaskName}"]`)
      .classList.remove('selected')

      if (code === 0) {
        atom.notifications.addSuccess(`Gulp task \`${this.lastTaskName}\` is finished`)
      } else if (code > 0) {
        atom.notifications.addError(`Gulp task is \`${this.lastTaskName}\` failed`)
      }

      this.lastTaskName = false
    }
  }

  taskButtonClickHandler(e) {
    const taskButton = e.target
    const taskName = taskButton.getAttribute('data-task')
    const runSameTask = this.lastTaskName === taskName

    if (this.lastTaskName !== false) {
      atom.notifications.addWarning(`Gup task \`${this.lastTaskName}\` is stopped`)
      this.lastTaskProcess.kill()
      this.exitHandler()

      if (runSameTask) {
        return
      }
    }

    taskButton.classList.add('selected')

    this.lastTaskName = taskName
    this.lastTaskProcess = new BufferedProcess({
      command: './node_modules/.bin/gulp',
      args: [taskName, '--cwd'],
      exit: this.bindedExitHandler,
      options: this.processOptions
    })
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      // This is used to look up the deserializer function. It can be any string, but it needs to be
      // unique across all packages!
      deserializer: 'gulp-runner/GulpRunnerView'
    }
  }

  // Tear down any state and detach
  destroy() {
    this.removeButtons()
    this.element.remove()
    this.subscriptions.dispose()

    if (this.lastTaskProcess !== false) {
      this.lastTaskProcess.kill()
    }
  }

  getElement() {
    return this.element
  }

  getTitle() {
    return 'Gulp runner'
  }
  
  getURI() {
    return package.uri
  }

  getDefaultLocation() {
    // This location will be used if the user hasn't overridden it by dragging the item elsewhere.
    // Valid values are "left", "right", "bottom", and "center" (the default).
    return 'bottom'
  }

  getAllowedLocations() {
    // The locations into which the item can be moved.
    return ['bottom']
  }

}
