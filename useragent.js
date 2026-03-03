export function isMobile(){
    let mobile;
    if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)){
    mobile = true;
    }else{
    mobile = false;
    }
    return mobile;
}