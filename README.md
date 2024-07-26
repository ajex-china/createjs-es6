# createjs的es6项目
此项目暂时只当做开发用，为了开发方便我使用了vue当做测试(因为后期要做兼容vue的测试)

# 注意
此项目easaljs已经完成，preloadjs完成大半，还剩下soundjs和tweenjs

StageGL是官方的2.0版本有问题，为了不覆盖官方之前的版本我用了AJStageGL,如果后续测试没有问题需要用AJStageGL替换StageGL

项目中依赖了createjs官方的2.0beta(暂时只有core,easal,tween)版本，大家可以按照官方的写法去重写之前的es5版本

为了兼容以前的项目，大家写的时候记得保留之前es5的方法和属性，可以标记为废弃但是不能不写

