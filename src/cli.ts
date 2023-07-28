import { build } from 'gluegun'

export const renameCLI = build('rename')
  .src(__dirname)
  .plugins('../node_modules', { matching: 'rename' })
  .help()
  .version()
  .defaultCommand(require("./commands/rename"))
  .create()