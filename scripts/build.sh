set -e

__scriptdir=$(cd "$(dirname "$0")";pwd)
__rootdir=$(cd "$__scriptdir";cd ..;pwd)
__distdir=$(cd "$__scriptdir";cd ../dist;pwd)

rm -rf $__distdir/*

cd $__rootdir
yarn build:rollup

cp $__rootdir/package.json $__distdir/package.json

cd $__distdir
pkg -C GZip pbsb-cli.js

zip -r -9 "$__distdir/output.zip" .
zip -r -9 "$__distdir/output-win.zip" ./pbsb-cli-win.exe
zip -r -9 "$__distdir/output-linux.zip" ./pbsb-cli-linux
zip -r -9 "$__distdir/output-macos.zip" ./pbsb-cli-macos
