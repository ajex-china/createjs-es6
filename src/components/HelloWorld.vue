<template>
  <div>
    <canvas id="canvas" width="1000" height="600"></canvas>
  </div>
</template>
<script setup >
import {onMounted, ref} from 'vue';
import Ticker from "@createjs/core/src/utils/Ticker.js";
import {Shape, Stage} from "@createjs/easeljs";
import StageGL from "@/utils/EaselJS/display/StageGL.js";
import AJStageGL from "@/utils/EaselJS/display/AJStageGL.js";

const init = () => {
  // const stage = new StageGL("canvas")
  // const stage = new Stage("canvas");
  const stage = new AJStageGL('canvas');
  stage.setClearColor('#fff')
  Ticker.timingMode = Ticker.RAF;
  Ticker.addEventListener("tick", stage);

  let shape = new Shape();
  shape.graphics.beginFill('#ff0000').drawRect(0, 0, 100, 100).endFill();
  shape.cache(0,0,100,100)
  stage.addChild(shape);


}
onMounted(()=>{
  init();
})
</script>
<style scoped>
.read-the-docs {
  color: #888;
}
</style>
