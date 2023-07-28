import { GluegunToolbox } from 'gluegun';
import { cleanUpFolder, execShellCommand, runCommand, showMoreDetails } from '../utils';

type RenameOptions = {
  oldName: string;
  newName: string;
  newBundleIdentifier: string;
};

type RenameConfirmationResponse = { confirmation: 'y' | 'Y' | 'n' | 'N' }

const acceptedRenameConfirmationRegex = /(Y|y)/g

async function getAndroidManifest (toolbox: GluegunToolbox, newName: string) {
  const ANDROID_MANIFEST_PATH = `${process.cwd()}/${newName}/android/app/src/main/AndroidManifest.xml`
  const manifest = await toolbox.filesystem.readAsync(ANDROID_MANIFEST_PATH)
  return manifest as string
}

function checkRootProject (toolbox: GluegunToolbox, projectName: string) {
  const exist = toolbox.filesystem.exists(`${process.cwd()}/${projectName}/app.json`)
  return Boolean(exist)
}

function getProjectNameLowerCase (projectName: string) {
  return projectName.toLowerCase()
}

function getProjectNameKebabCase (toolbox: GluegunToolbox, projectName: string) {
  return toolbox.strings.kebabCase(projectName)
}

function getProjectNameSnakeCase (toolbox: GluegunToolbox, projectName: string) {
  return toolbox.strings.snakeCase(projectName).toUpperCase()
}

module.exports = {
  name: 'rename',
  description: 'You would be able to rename your project',
  run: async (toolbox: GluegunToolbox) => {
    const { parameters, prompt, filesystem, print, system } = toolbox
    const { colors, info } = print
    const { red, green, yellow, cyan } = colors

    const { newName, oldName, newBundleIdentifier } = parameters.options as RenameOptions;

    const PROJECT_PATH = `${process.cwd()}/${newName}`

    print.info(
      yellow(`${red("CAREFUL")}: This will remove all other changes you haven't committed!`),
    )

    // const renameConfirmationPrompt = await prompt.ask<RenameConfirmationResponse>({
    //   type: "input",
    //   name: "confirmation",
    //   message: `Are you sure you want to rename your app (y/N)?`,
    // })

    // if (!acceptedRenameConfirmationRegex.test(renameConfirmationPrompt.confirmation)) {
    //   print.info(yellow("Rename aborted, there's no changes applied."))
    //   return
    // }

    const androidManifest = await getAndroidManifest(toolbox, newName)

    const oldBundleIdentifier = androidManifest.match(/package="([^"]+)"/)?.[1]

    const rootProjectExist = checkRootProject(toolbox, newName)

    if (!rootProjectExist) {
      print.info(yellow("You must be in the root of a React Native project to rename it."))
      return
    }

    if (!newName) {
      print.info(yellow("Project name has not been provided."))
      return
    } else {
      print.info(green(`New project name would be: ${newName}`))
    }

    if (!newBundleIdentifier) {
      print.info(yellow("BundleIdentifier has not been provided."))
      return
    } else {
      print.info(green(`New BundleIdentifier would be: ${newBundleIdentifier}`))
    }

    if (newName ===  oldName) {
      print.info(yellow("New project name is the same as the old one."))
      print.info(yellow("Aborting rename."))
      return
    }

    const OLD_NAME_LOWER = getProjectNameLowerCase(oldName)
    const NEW_NAME_LOWER = getProjectNameLowerCase(newName)

    const OLD_NAME_KEBAB = getProjectNameKebabCase(toolbox, oldName)
    const NEW_NAME_KEBAB = getProjectNameKebabCase(toolbox, newName)

    const OLD_NAME_SNAKE = getProjectNameSnakeCase(toolbox, OLD_NAME_LOWER)
    const NEW_NAME_SNAKE = getProjectNameSnakeCase(toolbox, NEW_NAME_LOWER)

    const ANDROID_OLD_NAME = '"app_name", "(.*) - (.*)"'
    const ANDROID_NEW_NAME = `"app_name", "${newName} - $2"`

    const IOS_OLD_NAME = /PRODUCT_NAME = "(\w+) - (\w+)"/g
    const IOS_NEW_NAME = `PRODUCT_NAME = "${newName} - $2"`

    async function rename(oldFile: string, newFile: string) {
      print.info(cyan(`Renaming ${oldFile} to ${newFile}`))
      return filesystem.renameAsync(oldFile, newFile)
    }

    await Promise.allSettled([
      rename(`${PROJECT_PATH}/ios/${oldName}.xcodeproj/xcshareddata/xcschemes/${oldName}.xcscheme`, `${newName}.xcscheme`),
      rename(`${PROJECT_PATH}/ios/${oldName}Tests/${oldName}Tests.m`, `${newName}Tests.m`),
      rename(`${PROJECT_PATH}/ios/${oldName}-Bridging-Header.h`, `${newName}-Bridging-Header.h`),
      rename(`${PROJECT_PATH}/ios/${oldName}.xcworkspace`, `${newName}.xcworkspace`),
      rename(`${PROJECT_PATH}/ios/${oldName}`, `${newName}`),
    ])
  
    // these we delay to avoid race conditions
    await Promise.allSettled([
      rename(`${PROJECT_PATH}/ios/${oldName}Tests`, `${newName}Tests`),
      rename(`${PROJECT_PATH}/ios/${oldName}.xcodeproj`, `${newName}.xcodeproj`),
    ])

    const oldPath = oldBundleIdentifier?.replace(/\./g, "/")
    const newPath = newBundleIdentifier.replace(/\./g, "/")

    if (oldBundleIdentifier !== newBundleIdentifier) {
      print.info(cyan(`Renaming bundle identifier to ${newBundleIdentifier}`))
  
      // move everything at the old bundle identifier path to the new one
      await Promise.allSettled([
        filesystem.moveAsync(
          `${PROJECT_PATH}/android/app/src/main/java/${oldPath}`,
          `${PROJECT_PATH}/android/app/src/main/java/${newPath}`,
        ),
        filesystem.moveAsync(
          `${PROJECT_PATH}/android/app/src/debug/java/${oldPath}`,
          `${PROJECT_PATH}/android/app/src/debug/java/${newPath}`,
        ),
      ])
    }

    const schemesList = await filesystem.listAsync(
      filesystem.path(`${PROJECT_PATH}/ios/${newName}.xcodeproj/xcshareddata/xcschemes/`),
    )
  
    // here's a list of all the files to patch the name in
    const filesToPatch = [
      `${PROJECT_PATH}/app.json`,
      `${PROJECT_PATH}/package.json`,
      `${PROJECT_PATH}/index.js`,
      `${PROJECT_PATH}/rnb-cli/src/tools/rnbv.js`,
      `${PROJECT_PATH}/android/settings.gradle`,
      `${PROJECT_PATH}/android/app/_BUCK`,
      `${PROJECT_PATH}/android/app/BUCK`,
      `${PROJECT_PATH}/android/app/build.gradle`,
      `${PROJECT_PATH}/android/app/src/debug/java/${newPath}/ReactNativeFlipper.java`,
      `${PROJECT_PATH}/android/app/src/main/AndroidManifest.xml`,
      `${PROJECT_PATH}/android/app/src/main/java/${newPath}/MainActivity.java`,
      `${PROJECT_PATH}/android/app/src/main/java/${newPath}/MainApplication.java`,
      `${PROJECT_PATH}/android/app/src/main/java/${newPath}/MainApplication.java`,
      `${PROJECT_PATH}/android/app/src/main/java/${newPath}/newarchitecture/MainApplicationReactNativeHost.java`,
      `${PROJECT_PATH}/android/app/src/main/java/${newPath}/newarchitecture/components/MainComponentsRegistry.java`,
      `${PROJECT_PATH}/android/app/src/main/java/${newPath}/newarchitecture/modules/MainApplicationTurboModuleManagerDelegate.java`,
      `${PROJECT_PATH}/android/app/src/main/jni/Android.mk`,
      `${PROJECT_PATH}/android/app/src/main/jni/MainApplicationTurboModuleManagerDelegate.h`,
      `${PROJECT_PATH}/android/app/src/main/jni/MainComponentsRegistry.h`,
      `${PROJECT_PATH}/android/app/src/main/res/values/strings.xml`,
      `${PROJECT_PATH}/android/app/src/release/java/${newPath}/ReactNativeFlipper.java`,
      `${PROJECT_PATH}/ios/Podfile`,
      `${PROJECT_PATH}/ios/${newName}/Info.plist`,
      `${PROJECT_PATH}/ios/${newName}.xcodeproj/project.pbxproj`,
      `${PROJECT_PATH}/ios/${newName}.xcworkspace/contents.xcworkspacedata`,
      `${PROJECT_PATH}/ios/${newName}Tests/${newName}Tests.m`,
      `${PROJECT_PATH}/ios/${newName}/AppDelegate.mm`,
      `${PROJECT_PATH}/ios/${newName}/LaunchScreen.storyboard`,
      ...(schemesList ?? []).map(
        (subdirectory) => `${PROJECT_PATH}/ios/${newName}.xcodeproj/xcshareddata/xcschemes/${subdirectory}`,
      ),
    ]
  
    // patch the files
    await Promise.allSettled(
      filesToPatch.map(async (file) => {
        // no need to patch files that don't exist
        const exists = await filesystem.existsAsync(filesystem.path(file))
        if (!exists) return
  
        const content = await filesystem.readAsync(filesystem.path(process.cwd(), file), "utf8")
  
        print.info(cyan(`Patching ${file} - ${oldName} to ${newName} and variants`))
  
        // replace all instances of the old name and all its variants
        const newContent = content?.replace(new RegExp(oldBundleIdentifier!, "g"), newBundleIdentifier)
          .replace(new RegExp(OLD_NAME_KEBAB, "g"), NEW_NAME_KEBAB)
          .replace(new RegExp(OLD_NAME_SNAKE, "g"), NEW_NAME_SNAKE)
          .replace(new RegExp(oldName, "g"), newName)
          .replace(new RegExp(OLD_NAME_LOWER, "g"), NEW_NAME_LOWER)
          .replace(new RegExp(ANDROID_OLD_NAME, "g"), ANDROID_NEW_NAME)
          .replace(new RegExp(IOS_OLD_NAME, "g"), IOS_NEW_NAME)
  
        // write the new content back to the file
        if (newContent) {
          await filesystem.writeAsync(file, newContent, { atomic: true })
          print.info(green(`Patched ${file} success`))
        }
      }),
    )

    await cleanUpFolder(newName);

    await runCommand(
      `cd ${newName} && npm i`,
      {
        loading: 'Installing dependencies',
        success: 'Dependencies installed',
        error: 'Failed to install dependencies',
      }
    )

    showMoreDetails(newName);
  }
};
