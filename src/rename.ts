import chalk from "chalk"
import { execShellCommand } from "./utils"
import { renameCLI } from "./cli"

function generateBundleIdentifier (projectName: string) {
  return `com.rootstrap.${projectName.toLowerCase()}`
}

function getOldName (projectName: string) {
  return require(`${process.cwd()}/${projectName}/app.json`).name
}

export async function renameProject (projectName: string) {
    const newName = projectName
    const newBundleIdentifier = generateBundleIdentifier(projectName)
    const oldName = getOldName(projectName)

    renameCLI.run('rename', { oldName, newName, newBundleIdentifier })
}