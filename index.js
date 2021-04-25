import * as fs from 'fs'
import * as core from '@actions/core'
import { context } from '@actions/github';
import { execSync } from 'child_process';

const projFile = core.getInput('project');

let projLines = fs.readFileSync(projFile, 'utf8').split('\n');
let verLine = 0;
let pgLine = 0;
let ver = '';

for (let i = 0; i < projLines.length; i++) {
  const trimmed = projLines[i].trim();

  if (trimmed.startsWith("<Version>") && trimmed.endsWith("</Version>")) {
    verLine = i;
    ver = trimmed.slice(9, -10);
    console.info(`Found project version ${ver} at line ${verLine}`);
    break;
  }

  if (!pgLine && trimmed == "<PropertyGroup>")
  {
    pgLine = i;
  }
}

if (!ver) {
  ver = "0.0.0";
  verLine = pgLine + 1;
  console.warn(`Could not find version property in project file, inserting at line ${verLine}`);
  projLines.splice(verLine, 0, `<Version>${ver}</Version>`);
}

const origVer = ver;
const versionTag = context.ref.startsWith('refs/tags/v');

if (versionTag) {
  ver = context.ref.split('/')[2].substring(1);
} else {
  try {
    execSync("git fetch --unshallow");
    ver = execSync("git describe --tags --match=v*").toString().trim().substring(1);
    const verParts = ver.split('-');
    if (verParts.length < 3 || !verParts.slice(-1)[0].startsWith('g')) {
      console.warn(`git describe returned version in unexpected format, using as-is`);
    } else {
      ver = `${verParts.slice(0,-2).join('-')}.${verParts.slice(-2).join('+')}`;
    }
  } catch (err) {
    console.error(err);
    console.warn(`git describe failed to provide a version number, using project version + commit ID`);
    ver = `${origVer}+g${context.sha.substring(0, 8)}`;
  }
}

if (origVer) {
  console.info(`Setting version: ${ver}`);
  projLines[verLine] = projLines[verLine].replace(origVer, ver);

  fs.writeFileSync(projFile, projLines.join('\n'));
}

const isRelease = versionTag && context.payload.base_ref == 'refs/heads/master';
if (isRelease) {
  console.info(`This is a public release`);
}

core.setOutput('is-release', isRelease);
core.setOutput('version', ver);
