import * as fs from 'fs'
import * as core from '@actions/core'
import { context } from '@actions/github';
import { execSync } from 'child_process';

const projFile = core.getInput('project');

let projLines = fs.readFileSync(projFile, 'utf8').split('\n');
let verLine = 0;
let ver = '';

for (let i = 0; i < projLines.length; i++) {
  const trimmed = projLines[i].trim();

  if (trimmed.startsWith("<Version>") && trimmed.endsWith("</Version>")) {
    verLine = i;
    ver = trimmed.slice(9, -10);
    console.info(`Found project version ${ver} at line ${verLine}`);
    break;
  }
}

if (!ver) {
  core.setFailed('Could not find version property in project file');
}

const origVer = ver;
const versionTag = context.ref.startsWith('refs/tags/v')
if (versionTag) {
  ver = context.ref.split('/')[2].substring(1)
} else {
  try {
    ver = execSync("git fetch --unshallow && git describe --tags --match=v*")
  } catch {
    console.warn(`git describe failed to provide a version number, using project version + commit ID`)
    ver += `-g${context.sha.substring(0, 8)}`
  }
}

if (origVer) {
  console.info(`Setting version: ${ver}`)
  projLines[verLine] = projLines[verLine].replace(origVer, ver);

  fs.writeFileSync(projFile, projLines.join('\n'))
}

core.setOutput('is-release', context.payload.base_ref == 'refs/heads/master')
core.setOutput('version', ver)
