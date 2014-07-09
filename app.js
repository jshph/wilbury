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
var last_start = 0; // from beginning of sound
var start_offset = 0; // from beginning of sound

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

    function play(offset) {
        if (typeof(offset) === 'undefined') offset = start_offset;
        else start_offset = offset;

        playing = true;

        last_start = context.currentTime;
        source = context.createBufferSource();
        source.buffer = buffer; //remind from snapshot, or redundant from init.
        source.connect(context.destination);
        source.start(0, offset % buffer.duration);

        refreshWidth(offset);
    }

    function pause() {
        playing = false;
        buffer = source.buffer; //snapshot

        source.stop();
        start_offset += context.currentTime - last_start;
    }

    function refreshWidth(offset) { //offset is wrap of start_offset
        if (playing) {
            if (typeof(offset) === 'undefined') offset = start_offset; // if resuming from straight pause-play

            soundProgress = context.currentTime - last_start + offset;
            soundPercent = (soundProgress / buffer.duration) * 100;
            //for animation
            $('.progress').width(soundPercent + "%");
            
            //and refresh number text
            $('.textProgress').html(soundProgress.toFixed(2) + " / " + buffer.duration.toFixed() + " secs.");
            window.requestAnimationFrame(function() {
                refreshWidth(offset);
            });
        }
    }

    $('#play_toggle').click(function() {
        if (!playing) play();
        else pause();
    });

    $('.player').click(function(e) {
        //x position relative to the top-left of element clicked.
        var newXpos = (e.clientX - $(this).offset().left);
        //percentage of progres
        var percentProgress = newXpos / divWidth;

        pause();
        play(percentProgress * buffer.duration);
    });
}