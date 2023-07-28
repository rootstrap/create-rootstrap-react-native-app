#!/usr/bin/env node

import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import { createSpinner } from 'nanospinner';
import { exec } from 'child_process'
import cfonts from 'cfonts';

// Define the options for the font
const options = {
  font: 'chrome', // You can choose from various fonts. Check the available options in the documentation.
  colors: ['#ffc83f', '#ffc83f', '#ffc83f'], // An array of colors to use for the text
  letterSpacing: 2, // Letter spacing
  lineHeight: 0, // Line height
  space: false, // Add an additional space between characters
  maxLength: '0', // Truncate text to a specific length (0 for no truncation)
  cli: false
};

export const showMoreDetails = async (projectName: string) => {
    cfonts.say(projectName, options);
    console.log(
        '\n',
        chalk(' 🔥 Your project is ready to go! \n\n'),
        chalk(`💻 Enter to your project: cd ${projectName} \n\n`),
        chalk('📱 Run your project: \n\n'),
        chalk('iOS     :  npm run ios:dev \n'),
        chalk('Android :  npm run android:dev \n\n'),
    );
};

export function renameAppDelegateMM (projectName: string) {
    // we handle a corner case because in the AppDelegate.mm file we have to change the name manually
    const appPath = path.join(__dirname, projectName);
    const appIOSPath = path.join(appPath, 'ios');
    const iosAppPath = path.join(appIOSPath, projectName);
    const file = path.join(
        iosAppPath,
        'AppDelegate.mm'
    )
    const contents = fs.readFileSync(file, {
        encoding: 'utf-8',
    });
    const replaced = contents.replace(/ReactNativeBase/gi, projectName)
    fs.writeFileSync(file, replaced);
}

export function renameAppEnvironments (projectName: string) {
    const appPath = path.join(__dirname, projectName);
    const appIOSPath = path.join(appPath, 'ios');
    const iosAppPath = path.join(appIOSPath, `${projectName}.xcodeproj`);
    const file = path.join(
        iosAppPath,
        'project.pbxproj'
    )
    const contents = fs.readFileSync(file, {
        encoding: 'utf-8',
    });
    const replaced = contents
        .replace(/react-native-base/gi, projectName)
        .replace(/RNBase/gi, projectName)
        .replace(`INFOPLIST_KEY_CFBundleDisplayName = "${projectName}";`, '')

    fs.writeFileSync(file, replaced);
}

type SpinnerOptions = {
    loading: string,
    success: string,
    error: string
}

export async function renameProject (
    projectName: string,
    { loading = 'loading ....', success = 'success', error = 'error' }: SpinnerOptions
) {
    const spinner = createSpinner(loading).start({ text: loading });
    const command = `cd ${projectName} && npx -y react-native-rename@latest "${projectName}"`
    try {
        // we use react-native-rename to make the rename process easier
        await execShellCommand(command);
    
        renameAppDelegateMM(projectName)

        renameAppEnvironments(projectName)

        spinner.success({ text: success });
    } catch (error) {
        if (error instanceof Error) {
            spinner.error({ text: error.message });
        }
        console.log(chalk.red(`Failed to execute ${command}`), error);
        process.exit(1);
    }
}

export const initGit = async (projectName: string) => {
    await execShellCommand(`cd ${projectName} && git init && cd ..`);
};

// Update package.json infos, name and  set version to 0.0.1
export const updatePackageInfos = async (projectName: string) => {
    const packageJsonPath = path.join(
        process.cwd(),
        `${projectName}/package.json`
    );
    const packageJson = fs.readJsonSync(packageJsonPath);
    packageJson.osMetadata = { initVersion : packageJson.version };
    packageJson.version = '0.0.1';
    packageJson.name = projectName?.toLowerCase();
    fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
};

export const updateReadme = async (projectName: string) => {
    const readmePath = path.join(
        process.cwd(),
        `${projectName}/README.md`
    );
    const readme = fs.readFileSync(readmePath, {
        encoding: 'utf-8',
    });
    const replaced = readme
        .replace(/ReactNativeBase/gi, projectName)
        .replace(/React Native Base/gi, projectName)
    fs.writeFileSync(readmePath, replaced);
}

export function removeGit (projectName: string) {
    fs.removeSync(path.join(process.cwd(), `${projectName}/.git`));
}

export const cleanUpFolder = async (projectName: string) => {
    const spinner = createSpinner(`Clean and Setup project folder`).start();
    try {
        await initGit(projectName);
        updateReadme(projectName)
        spinner.success({ text: 'Clean and Setup  project folder' });
    } catch (error) {
        if (error instanceof Error) {
            spinner.error({ text: error.message });
        }
        console.log(chalk.red(`Failed to clean up project folder`), error);
        process.exit(1);
    }
};

export const execShellCommand = (cmd: string) => {
  return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
          if (error) {
              console.warn(error);
              reject(error);
          }
          resolve(stdout ? stdout : stderr);
      });
  });
};

export const runCommand = async (
  command: string,
  { loading = 'loading ....', success = 'success', error = 'error' }: SpinnerOptions
) => {
  const spinner = createSpinner(loading).start({ text: loading });
  try {
    await execShellCommand(command);
    spinner.success({ text: success });
  } catch (err) {
    spinner.error({ text: error });
    console.log(chalk.red(`Failed to execute ${command}`), error);
    process.exit(1);
  }
};