function BufferLoader(context, soundList, callback) {
    this.context = context;
    this.soundList = soundList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
}

// loadBuffer also loads sound metadata into the bufferList array.
BufferLoader.prototype.loadBuffer = function(sound, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", sound.url, true);
    request.responseType = "arraybuffer";

    var loader = this;

    request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
        request.response,
        function(buffer) {
        if (!buffer) {
            alert('error decoding file data: ' + url);
            return;
        }
        // buffer is the main purpose, but metadata offset and url are also part of the object.
        loader.bufferList.push({"buffer": buffer, "offset": sound.offset, "url": sound.url});
        console.log('loaded buffer ' + index + ": " + sound.url);
        if (++loader.loadCount == loader.soundList.length)
            loader.onload(loader.bufferList);
        },
        function(error) {
            console.error('decodeAudioData error', error);
        }
    );
    }

    request.onerror = function() {
        alert('BufferLoader: XHR error');
    }

    request.send();
}

BufferLoader.prototype.load = function() {
    for (var i = 0; i < this.soundList.length; ++i) {
        this.loadBuffer(this.soundList[i], i);
    }
}



function AudioHandler(bufferList, context) {
    this.recent_start;
    this.recent_pause;
    this.bufferList = bufferList;
    this.source;
    this.context = context;
    this.Player = Player(bufferList.length);
}

AudioHandler.prototype.playManager = function(bufferList, buffer_index, offset_percentage) { //index is number - 1
    // solely for iteration through buffers.
    if (buffer_index >= bufferList.length)
        console.log('end of playlist reached!'); // and then exit funciton....

    while (buffer_index < bufferList.length) {
        this.play(bufferList[buffer_index], buffer_index, offset_percentage);
    }
    
}

AudioHandler.prototype.play = function(buffer, index, offset_percentage) {
    // call to refresh correct div, id'd by index.
    var source = this.source;

    source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    source.start(0, offset_percentage * source.buffer.duration % source.buffer.duration);

    this.Player.playing = true;
    
    this.Player.render(index, offset_percentage);
}

function Player(numBuffers) {
    this.numBuffers = numBuffers;
    this.playing = false;

    //construct div elements here.
}

Player.prototype.render = function(index, offset_percentage) {
    if (playing) {

    }
}


window.onload = init;

var context, bufferloader;

function init() {
  // Fix up prefixing
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    context = new AudioContext();
    bufferloader = new BufferLoader(
        context,
        [
            {"url": "Hard To Smile.mp3", "offset": 5},
            {"url": "Misterwives - Reflections (Flaxo Remix).mp3", "offset": 10},
            {"url": "YesYou ft. Marcus Azon - Frivolous Life (Vlad Lucan Remix}.mp3", "offset": 8}
        ],
        finishedLoading
        );

    bufferloader.load();
    console.log(bufferloader);
    function finishedLoading(retrieved_bufferList) {
        //bufferList = retrieved_bufferList;
        console.log('loaded!');
        //call AudioManager to construct
    }
}