'use babel';

import GulpRunnerView from './gulp-runner-view'
import { CompositeDisposable, Disposable } from 'atom'
import package from '../package.json'

export default {

  view: null,
  subscriptions: null,

  activate(state) {
    this.subscribeActions(state)
  },
  
  subscribeActions(state) {
    this.subscriptions = new CompositeDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === package.uri) {
          this.view = new GulpRunnerView()

          return this.view
        }
      }),

      // Register command that toggles this view
      atom.commands.add('atom-workspace', {
        'gulp-runner:toggle': () => this.toggle()
      }),

      // Register command that toggles this view
      atom.commands.add('atom-workspace', {
        'gulp-runner:update-tasks': () => this.updateTasks()
      }),

      new Disposable(() => {
        atom.workspace.getPaneItems().forEach(item => {
          if (item instanceof GulpRunnerView) {
            item.destroy()
          }
        })
      })
    )
  },
  
  initialize() {
    console.log('initialize')
  },

  deactivate() {
    console.log('deactivate')
    this.subscriptions.dispose()
  },

  toggle() {
    console.log('toggle')
    atom.workspace.toggle(package.uri)
  },

  updateTasks() {
    console.log('update tasks')
    if (this.view) {
      this.view.updateTasks()
    }
  },

  deserializeGulpRunnerView(serialized) {
    this.subscribeActions(serialized)
    this.view = new GulpRunnerView()

    return this.view
  }

}
