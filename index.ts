import url = require('url');  
import EventSource = require('eventsource');
import Axios = require('axios');

const axios = Axios.default;

type Severity = 'info' | 'error'

function logdate(){
    return '[' + new Date().toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '')
    + '] ';
}

function requireValidUrl(name: string, str : string){
  const url = new URL(str); // throws TypeError if invalid
  if (!url.protocol || ['http','https'].indexOf(url.protocol) < 0) 
    throw new TypeError(`The provided ${name} URL is invalid: ${str}`)
  
}

interface Options {
  source: string
  target: string
  logger?: Pick<Console, Severity>
  idle_reconnect: number;
  health_interval: number;
}

class Client {
  source: string;
  target: string;
  logger: Pick<Console, Severity>;
  events!: EventSource; // SSE client 
  idle_reconnect: number; // millis - how long if there are no events to restart the connection. If negative, never restart
  last_event: number;  // the timestamp of the last event in millis

  constructor ({ source, target, logger = console, idle_reconnect = 1000*60*60*24, health_interval = 60*1000}: Options) {
    this.source = source;
    this.target = target;
    this.logger = logger!;
    this.idle_reconnect = idle_reconnect;
    this.last_event = 0;

    requireValidUrl('source', this.source);
    requireValidUrl('target', this.target);
    
    // don't healthcheck if the URL is invalid!
    setInterval(this.oninterval.bind(this), health_interval);
    
  }

  static async createChannel (provider = 'https://smee.io') {
    let url = new URL(provider);
    let target = `${url.protocol || 'https:'}//${url.host}/new`;
    console.log('createChannel( ' + target + ' )');
    return await axios.head(target, {
      maxRedirects: 0,
      validateStatus: (st)=>[301, 302].indexOf(st) >= 0,
    }).then((resp) => {
      return resp.headers.location;
    });
  }

  onmessage (msg: MessageEvent) {
    
    const data = JSON.parse(msg.data)

    const target = new URL(this.target);

    if(typeof data.query === 'object'){
      Object.entries(data.query)
          .forEach(([k,v])=>target.searchParams.set(k, `${v}`));
      delete data.query
    }

    const body = !data.body ? "" 
                : typeof data.body === 'string' ? data.body 
                : JSON.stringify(data.body);
    const bodyLength = Buffer.byteLength(body, 'utf8');
    delete data.body

    const headers : any = {};
    Object.entries(data)
      .filter(([key]) => ['host'].indexOf(key.toLowerCase()) < 0 )// do not re-set host header!!
      .forEach( ([key, val]) => headers[key] = val )

    headers['content-length']= `${bodyLength}`;
    
    axios.post(target.toString(), body, {
      headers
    }).then(ok => {
      this.logger.info(logdate(), `${this.source} => ${ok.request.method} ${ok.request.url} - ${ok.status}`)
    }, error => {
      // see https://github.com/axios/axios#handling-errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        this.logger.error(logdate(), `${this.source} => ${error.request.method} ${error.request.url} - ${error.response.status}: `, error);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        this.logger.error(logdate(), `${this.source} => ${error.request.method} ${error.request.url} - no response: `, error);
      } else {
        // Something happened in setting up the request that triggered an Error
        this.logger.error(`${this.source} => ${error.message}`);
      }
    }).finally(()=>{
      this.last_event = Date.now()
    });
  }

  onopen () {
    this.logger.info(logdate(), 'Connected', this.events.url)
  }

  onerror (err: any) {
    this.logger.error(logdate(), err)
  }

  // adding a method to ensure that the client is not closed
  oninterval(){
      let readyState = this.events ? this.events.readyState : -1;
      if(readyState < 0){
          this.logger.info(logdate(), `WARNING - EventSource.readyState=${readyState} is not connecting (did you call start()?)... for [${this.source} => ${this.target}]`);
      } if(readyState == 0){
          this.logger.error(logdate(), `WARNING - EventSource.readyState=${readyState} is Connecting... for [${this.source} => ${this.target}]`);
      } else if(readyState == 1
          && this.idle_reconnect > 0
          && Date.now() - this.last_event > this.idle_reconnect){
          this.logger.info(logdate(), `RESTARTING - Still connected (EventSource.readyState=${readyState}), ` +
            `but no events for ${this.idle_reconnect} ms. Restarting connection to [${this.source} => ${this.target}] just in case.`);
          this.start();
      } else if(readyState > 1){ // error is 2
          this.logger.error(logdate(), `RESTARTING - Invalid EventSource.readyState=${readyState} for [${this.source} => ${this.target}]`);
          this.start();
      }
  }

  start () {
    this.last_event = Date.now(); // clear flag
    const old_events = this.events; // store old events object
    const events = new EventSource(this.source);

    // Reconnect immediately
    (events as any).reconnectInterval = 0 // This isn't a valid property of EventSource

    events.addEventListener('message', this.onmessage.bind(this))
    events.addEventListener('open', this.onopen.bind(this))
    events.addEventListener('error', this.onerror.bind(this))

    this.logger.info(logdate(), `Forwarding ${this.source} to ${this.target}`)
    this.events = events

    if(old_events){ // Close after open to ensure nothing is missed, extra is ok...
        this.logger.info(logdate(), `Closing previous connection [${this.source} => ${this.target}] (old EventSource was in readyState=${old_events.readyState})`);
        try{ old_events.close();}
        catch(err){ this.logger.error(logdate(), err); }
    }

    return events
  }
}

export = Client
