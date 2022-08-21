var d = new Date();
var n = d.getFullYear();
document.getElementById("year").innerHTML = n;


// after the page is loaded, after 5 seconds remove the class "glitch" from some span from h1
setTimeout(function(){
    document.getElementsByName("glitch").forEach(function(e){
        e.classList.add("glitch");
       
    });
} , 2000);
setTimeout(function(){
document.getElementsByName("glitch").forEach(function(e){
    
    e.classList.remove("box");
});

} , 3000);


setTimeout(function(){
    document.getElementsByName("glitch").forEach(function(e){
        e.classList.remove("glitch");
    });
} , 5000);


$(document).ready(function () {
    // typing animation
    (function ($) {
      $.fn.writeText = function (content) {
        var contentArray = content.split(""),
          current = 0,
          elem = this;
        setInterval(function () {
          if (current < contentArray.length) {
            elem.text(elem.text() + contentArray[current++]);
          }
        }, 80);
      };
      // typing delete animation only the two last letters
             $.fn.deleteText = function (content) {
        var contentArray = content.split(""),
          current = contentArray.length,
          elem = this;
        setInterval(function () {
          if (current > 0) {
            elem.text(elem.text().slice(0, -1));
            current--;
          }
        }, 80);
      };
    } (jQuery));



    $("#holder").writeText("D U A R T E");
    //wait for the animation to finish then after 2 seconds delete the caracters "T E"
    setTimeout(function(){
        $("#holder").deleteText(" T E");
    } , 2000);
    //wait for the animation to finish then after 2 seconds and write the caracters ". C H"
    // setTimeout(function(){
    //     $("#holder").deleteText(" ");
    //     $("#holder").writeText(".");
    // }
    // , 5000);


});


$("#persiga").flip({autoSize:false});
$("#gloone").flip({autoSize:false});
$("#wallspot").flip({autoSize:false});
$("#easypoll").flip({autoSize:false});
