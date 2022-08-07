# pbsb-cli
command-line interface for pbsb

# how to use
```
pbsb-cli -h
```
- windows: pbsb-cli.exe -h
- linux: pbsb-cli.linux -h
- macos: pbsb-cli.macos -h

## help
<details>
<summary>help output</summary>
<pre>
command-line interface for pbsb

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command

Commands:
  call [options] <pathname>     simple call server
  pub [options] <string>        publish message
  sub [options]                 subcribe message
  req [options]                 request message
  consume [options] <filename>  consume message from message queue
  produce [options] <filename>  produce message to message queue
  share [options] <filepath>    share file
  sget [options]                download files by subscribing channel (like
                                wget)
  chat [options] <channel>      simple chat via channels
  host [options] <filename>     host http server based on script
  feeder [options]              Feed tg bot-updates to MQ
</pre>
</details>

## feeder

<details>
<summary>help output</summary>
<pre>
Feed tg bot-updates to MQ

Options:
  -T, --token <string>    bot token
  -s, --server [address]  server address (default: "localhost:9292")
  -c, --channel <name>    mq namespace
  -a, --ack               auto ack when message fetched
  -x, --proxy [address]   http proxy for request
  -t, --ttl [second]      message default ttl (s) (default: "900")
</pre>
</details>

## share

<details>
<summary>help output</summary>
<pre>
share file

Arguments:
  filepath                filepath of file to be share

Options:
  -w, --watch             watch file changes and send a new file for each
                          change
  -c, --channel <name>    channel name
  -s, --server [address]  server address (default: "localhost:9292")
  -m, --multicast         message multicast (default: true)
  -c, --cache             message cache (default: false)
</pre>
</details>

## sget

<details>
<summary>help output</summary>
<pre>
download files by subscribing channel (like wget)

Options:
  -c, --channel <name>     channel name
  -s, --server [address]   server address (default: "localhost:9292")
  -o, --output [filename]  write to file instead of stdout
  -w, --watch              watch channel and downloading the latest file
  -i, --interval [ms]      interval of each request (default: "1000")
  -r, --retry [number]     maximum number of retries in case of request errors
                           (default: "10")
  -S, --shell [string]     a shell script will be executed after the file is
                           changed
</pre>
</details>

## host

<details>
<summary>help output</summary>
<pre>
host http server based on script

Arguments:
  filename                 server script filename

Options:
  -s, --server [address]   server address (default: "localhost:9292")
  -r, --router <string>    host router
  -i, --instance [number]  instance number (default: "1")
</pre>
</details>

## chat

<details>
<summary>help output</summary>
<pre>
simple chat via channels

Arguments:
  channel                  channel path

Options:
  -u, --username [string]  chat username
  -s, --server [address]   server address (default: "localhost:9292")
  -c, --codecs [string]    chat message codecs
</pre>
</details>

## call

<details>
<summary>help output</summary>
<pre>
simple call server

Arguments:
  pathname                pathname

Options:
  --json                  format response body to json (default: true)
  -s, --server [address]  server address (default: "localhost:9292")
  -p, --payload [string]  payload data
  -q, --query [string]    query data
</pre>
</details>

## pub

<details>
<summary>help output</summary>
<pre>
publish message

Arguments:
  string                  message body

Options:
  --json                  auto try format response body to json (default: true)
  -c, --channel <name>    channel name
  -s, --server [address]  server address (default: "localhost:9292")
  -m, --multicast         message multicast (default: true)
  -c, --cache             message cache (default: false)
</pre>
</details>

## sub

<details>
<summary>help output</summary>
<pre>
subcribe message

Options:
  --json                  auto try format response body to json (default: true)
  -c, --channel <name>    channel name
  -s, --server [address]  server address (default: "localhost:9292")
  -m, --mime [string]     custom mime type
  -p, --persist           persist connect (default: false)
</pre>
</details>

## consume

<details>
<summary>help output</summary>
<pre>
consume message from message queue

Arguments:
  filename                 consumer javascript filename

Options:
  -s, --server [address]   server address (default: "localhost:9292")
  -c, --channel <name>     message queue namespace
  -a, --ack                auto ack when message fetched
  -p, --priority [weight]  The weight of the current consumer in the priority
                           (default: "0")
  -d, --dead               fetch messages from the dead letter queue
</pre>
</details>

## produce

<details>
<summary>help output</summary>
<pre>
produce message to message queue

Arguments:
  filename                producer javascript filename

Options:
  -s, --server [address]  server address (default: "localhost:9292")
  -c, --channel <name>    message queue namespace
</pre>
</details>

# todo
- [ ] Signature auth
- [ ] Support typescript for worker
- [ ] More features for a stable production environment

# BTW

### why vscode exclude /dist ?
[issue](https://github.com/vercel/pkg/issues/1589#issuecomment-1108856897)

### How to get permission to call service ?
contact [me](https://github.com/zhzLuke96)

# Maintainers

[@zhzluke96](https://github.com/zhzLuke96)

# Contributing

Feel free to dive in! [Open an issue](https://github.com/zhzLuke96/pbsb-cli/issues/new) or submit PRs.

# LICENSE

Code is licensed under the [MIT License](./LICENSE).
