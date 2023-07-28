#!/usr/bin/env node

import chalk from 'chalk'
import { cleanUpFolder, showMoreDetails, runCommand, removeGit } from './utils'
import { renameProject } from './rename';

const createRootstrapApp = async () => {
    // get project name from command line
    const projectName = process.argv[2];

    // check if project name is provided
    if (!projectName) {
        console.log(chalk.red('Please provide a project name'));
        process.exit(1);
    }

    const cloneStarter = `git clone --depth=1 https://github.com/rootstrap/react-native-base.git ${projectName}`;

    // cloning starter project template
    await runCommand(cloneStarter, {
        loading: 'Download and extract template',
        success: 'Template downloaded and extracted',
        error: 'Failed to download and extract template',
    });

    removeGit(projectName)

    await renameProject(projectName)
}

createRootstrapApp()