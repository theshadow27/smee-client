# smee-client Docker Container

This fork of `smee-client` includes stability fixes, dependency updates, and a github ci pipeline. 
In contrast to other containerized forks, this one uses file-based configuration to enable more 
than one smee fowarders per client container. 

As of 1.3, the client codebase has diverged from `protobot/smee-client` because several very outdated
dependencies had to be completely replaced. This effectivly required a refactor, where `superagent`
was replaced with `axios`. 

## Using the container

This repo publishes images to DockerHub with the tag [theshadow27/smee-client](https://hub.docker.com/repository/docker/theshadow27/smee-client/general)
so it is easy to use in a Docker near you. 


### Create the config file `etc/smee.json`:

You can have as many syncs as needed within this file.

``` json
{
    "forward":[
      {
          "description": "Forwarding for custom wordpress rest hook",
          "source": "https://smee.io/zh2TGe8dg1AZWxC",
          "target": "http://wordpress/wp-json/myrestsvc/v1/sync_stuff"
      },
      {
          "description": "Forwarding jenkins bitbucket plugin",
          "source": "https://smee.io/dy9LCOji6kH2A1f",
          "target": "http://jenkins/bitbucket-scmsource-hook/notify"
      }
    ]
  }
```

### Add the container to `docker-compose.json`:

``` yaml
version: '3.9'
services:
 
 ... 
 
 smee-client:
    image: theshadow27/smee-client:latest
    container_name: smee-client
    volumes:
      - ./etc/smee.json:/usr/src/smee.io/etc/smee.json:ro
```

### CI/CD

Added via (Github Worflows)[https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions]:

1. (semantic-release)[https://github.com/semantic-release/semantic-release] action for autotagging
2. Docker (build-push)[https://github.com/docker/build-push-action] action handles all build and test

It should only trigger on the master branch. 


## Build and Test

Locally, you can build and test with `docker build . -t 'smee-client:latest' `. 

It is a multistage docker build including tests. 






# Original README for the node-js `smee-client` Follows

<h2 align="center">smee-client</h2>
<p align="center">Client and CLI for smee.io, a service that delivers webhooks to your local development environment.</p>
<p align="center"><a href="https://npmjs.com/package/smee-client"><img src="https://img.shields.io/npm/v/smee-client/latest.svg" alt="NPM"></a> <a href="https://travis-ci.com/probot/smee-client"><img src="https://badgen.now.sh/travis/probot/smee-client" alt="Build Status"></a> <a href="https://codecov.io/gh/probot/smee-client/"><img src="https://badgen.now.sh/codecov/c/github/probot/smee-client" alt="Codecov"></a></p>

<p align="center"><a href="https://github.com/probot/smee.io">Looking for <strong>probot/smee.io</strong>?</a></p>

## Installation

Install the client with:

```
$ npm install -g smee-client
```

## Usage

### CLI

The `smee` command will forward webhooks from smee.io to your local development environment.

```
$ smee
```

Run `smee --help` for usage.

### Node Client

```js
const SmeeClient = require('smee-client')

const smee = new SmeeClient({
  source: 'https://smee.io/abc123',
  target: 'http://localhost:3000/events',
  logger: console
})

const events = smee.start()

// Stop forwarding events
events.close()
```
