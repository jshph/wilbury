//BUFFERLOADER CLASS
function BufferLoader(context, url, callback) {
  this.context = context;
  this.url = url;
  this.onload = callback;
  this.buffer; //this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function() {
    // Load buffer asynchronously
    var loader = this;

    var request = new XMLHttpRequest();
    request.open("GET", loader.url, true);
    request.responseType = "arraybuffer";

    request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
        request.response,
        function(buffer) {
            if (!buffer) {
                alert('error decoding file data: ' + url);
                return;
            }
            loader.buffer = buffer;
            loader.onload(loader.buffer);
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

/*BufferLoader.prototype.loadBuffer = function(url, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
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
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
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
    for (var i = 0; i < this.urlList.length; ++i)
        this.loadBuffer(this.urlList[i], i);
}*/
/*~~~~~~~~~~*/


window.onload = init;

var context;
var bufferLoader;
var source;
var buffer;
var last_start = 0;
var start_offset = 0;

var soundProgress = start_offset;

var divWidth = 600;

var updatedWidth;

var playing = false;


function init() {
  // Fix up prefixing
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    context = new AudioContext();
    bufferloader = new BufferLoader(
        context,
        "Hard To Smile.mp3",
        finishedLoading
        );

    bufferloader.loadBuffer();

    function finishedLoading(retrieved_buffer) {
        buffer = retrieved_buffer;
    }

    function play() {
        console.log('playing');
        playing = true;

        last_start = context.currentTime;
        source = context.createBufferSource();
        source.buffer = buffer; //remind from snapshot, or redundant from init.
        source.connect(context.destination);
        source.start(0, start_offset % buffer.duration);
        refreshWidth();
    }

    function pause() {
        console.log('stopped');
        playing = false;
        buffer = source.buffer; //snapshot

        source.stop();
        start_offset += context.currentTime - last_start;
    }

    function refreshWidth() {
        if (playing) {
            soundProgress = context.currentTime - last_start + start_offset;
            soundPercent = (soundProgress / buffer.duration) * 100;
            //for animation
            $('#progress').width(soundPercent + "%");
            window.requestAnimationFrame(refreshWidth);
        }
    }

    $('#play').click(function() {
        play();
    });

    $('#stop').click(function() {
        pause();
    })

    /*$('#player').click(function(e) {
        //x position relative to the top-left of element clicked.
        var newXpos = (e.clientX - $(this).offset().left);
        //percentage of progres
        var percentProgress = newXpos / divWidth;

        var stoppedTime = context.currentTime;
        source.stop();
        playing = false;

        //refreshed start, offsetted
        source = context.createBufferSource();
        source.buffer = bufferList[0];
        source.connect(context.destination);

        playing = true;
        source.start(0, stoppedTime * percentProgress);

        refreshWidth(stoppedTime);
    });*/
}