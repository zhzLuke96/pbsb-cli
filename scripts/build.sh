set -e

__scriptdir=$(cd "$(dirname "$0")";pwd)
__rootdir=$(cd "$__scriptdir";cd ..;pwd)
__distdir=$(cd "$__scriptdir";cd ../dist;pwd)

rm -rf $__distdir/*

cd $__rootdir
version=$(node -pe "require('./package.json').version")
yarn build:rollup

cp $__rootdir/package.json $__distdir/package.json

cd $__distdir
pkg -C GZip pbsb-cli.js

zip -r -9 "$__distdir/pbsb-cli_v$version.zip" .
zip -r -9 "$__distdir/pbsb-cli-win_v$version.zip" ./pbsb-cli-win.exe
zip -r -9 "$__distdir/pbsb-cli-linux_v$version.zip" ./pbsb-cli-linux
zip -r -9 "$__distdir/pbsb-cli-macos_v$version.zip" ./pbsb-cli-macos
