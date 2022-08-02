# pbsb-cli
command-line interface for pbsb

# how to use
```
pbsb-cli -h
```

## help
```
Usage: pbsb-cli [options] [command]

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
  help [command]                display help for command
```

## call
```
Usage: pbsb-cli call [options] <pathname>

simple call server

Arguments:
  pathname                pathname

Options:
  --json                  format response body to json (default: true)
  -s, --server [address]  server address (default: "localhost:9292")
  -p, --payload [string]  payload data
  -q, --query [string]    query data
  -h, --help              display help for command
```

## pub
```
Usage: pbsb-cli pub [options] <string>

publish message

Arguments:
  string                  message body

Options:
  --json                  auto try format response body to json (default: true)
  -c, --channel <name>    channel name
  -s, --server [address]  server address (default: "localhost:9292")
  -m, --multicast         message multicast (default: true)
  -c, --cache             message cache (default: false)
  -h, --help              display help for command
```

## sub
```
Usage: pbsb-cli sub [options]

subcribe message

Options:
  --json                  auto try format response body to json (default: true)
  -c, --channel <name>    channel name
  -s, --server [address]  server address (default: "localhost:9292")
  -m, --mime [string]     custom mime type
  -p, --persist           persist connect (default: false)
  -h, --help              display help for command
```

## consume
```
Usage: pbsb-cli consume [options] <filename>

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
  -h, --help               display help for command
```

## produce
```
Usage: pbsb-cli produce [options] <filename>

produce message to message queue

Arguments:
  filename                producer javascript filename

Options:
  -s, --server [address]  server address (default: "localhost:9292")
  -c, --channel <name>    message queue namespace
  -h, --help              display help for command
```

# todo
- [ ] host http server
- [ ] chat
- [ ] file share
- [ ] signature auth
- [ ] support typescript for worker


