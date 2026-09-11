const DEFAULT_TIMEOUT_MS = 15000;

// Menambahkan AbortController+timeout ke sebuah requestOptions object.
// Mengembalikan { cancel } - panggil cancel() setelah request selesai (baik sukses/gagal)
// supaya timer-nya tidak nyangkut.
function withTimeout(requestOptions, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    requestOptions.signal = controller.signal;
    return { cancel: () => clearTimeout(timeoutId) };
}

function requestJSON(method, target_url, responseFunction, datajson, tokenkey, tokenvalue) {
    let myHeaders = new Headers();

    // Jika token disediakan, tambahkan header token
    if (tokenkey && tokenvalue) {
        myHeaders.append(tokenkey, tokenvalue);
    }

    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");

    let requestOptions = {
        method,
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);
    if (datajson !== undefined) {
        requestOptions.body = JSON.stringify(datajson);
    }

    fetch(target_url, requestOptions)
        .then(response => {
            const status = response.status;
            return response.text().then(result => {
                let parsedResult;
                try {
                    parsedResult = JSON.parse(result);
                } catch (parseError) {
                    parsedResult = null;
                }
                responseFunction({ status, data: parsedResult });
            });
        })
        .catch(error => {
            // Jaringan gagal, request timeout, atau CORS ditolak - fetch() tidak pernah
            // resolve dengan sebuah response, jadi responseFunction tidak akan pernah
            // dipanggil kalau ini tidak ditangani. status:0 menandakan kegagalan jaringan
            // (bukan status HTTP asli, yang selalu >= 100).
            console.log('error', error);
            responseFunction({ status: 0, data: null });
        })
        .finally(cancel);
}

export function getJSON(target_url, responseFunction, tokenkey = null, tokenvalue = null) {
    requestJSON('GET', target_url, responseFunction, undefined, tokenkey, tokenvalue);
}

export function postJSON(target_url, datajson, responseFunction, tokenkey = null, tokenvalue = null) {
    requestJSON('POST', target_url, responseFunction, datajson, tokenkey, tokenvalue);
}

export function deleteJSON(target_url, datajson, responseFunction, tokenkey = null, tokenvalue = null) {
    requestJSON('DELETE', target_url, responseFunction, datajson, tokenkey, tokenvalue);
}

export function putJSON(target_url, datajson, responseFunction, tokenkey = null, tokenvalue = null) {
    requestJSON('PUT', target_url, responseFunction, datajson, tokenkey, tokenvalue);
}

// errorFunction (opsional) dipanggil dengan sebuah Error kalau elemen tidak ada,
// server membalas status non-2xx, jaringan gagal, atau request timeout.
export function insertHTML(target_url,id,runFunction,errorFunction = null){
    const fail = (error) => {
        console.log("Failed to load HTML from "+target_url+" into #"+id, error);
        if (typeof errorFunction === 'function') errorFunction(error);
    };

    const element = document.getElementById(id);
    if (!element) {
        fail(new Error(`Element with ID "${id}" not found.`));
        return;
    }

    var requestOptions = {
    method: 'GET',
    redirect: 'follow'
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(result => { element.innerHTML = result; })
    // Two-argument then: an exception thrown inside runFunction must not be reported as a load failure.
    .then(() => runFunction(), fail)
    .finally(cancel);
}

export function getDomHTML(target_url,domFunction){
    var requestOptions = {
    method: 'GET',
    redirect: 'follow'
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text())
    .then(result => {
        const parser = new DOMParser();
        const htmlDom = parser.parseFromString(result, "text/html");
        domFunction(htmlDom);
    })
    .catch(error => console.log('error', error))
    .finally(cancel);
}

export function postFile(target_url,id,formdataname,responseFunction) {
    const input = document.getElementById(id);
    const file = input.files[0];
    const formData = new FormData();
    formData.append(formdataname, file);
    var requestOptions = {
        method: 'POST',
        body: formData,
        redirect: 'follow'
        };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text())
    .then(result => {
        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch (parseError) {
            parsed = null;
        }
        responseFunction(parsed);
    })
    .catch(error => {
        console.log('error', error);
        responseFunction(null);
    })
    .finally(cancel);
}

//make sure formdataname use in the backend to get data file
export function postFileWithHeader(target_url,tokenkey,tokenvalue,id,formdataname,responseFunction) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);
    myHeaders.append("Accept", "application/json");

    const input = document.getElementById(id);
    const file = input.files[0];
    const formData = new FormData();
    formData.append(formdataname, file);
    var requestOptions = {
        method: 'POST',
        body: formData,
        redirect: 'follow',
        headers: myHeaders
        };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text())
    .then(result => {
        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch (parseError) {
            parsed = null;
        }
        responseFunction(parsed);
    })
    .catch(error => {
        console.log('error', error);
        responseFunction(null);
    })
    .finally(cancel);
}

// function responseFunction(response) {
//     console.log('HTTP Status:', response.status);
//     console.log('Response Data:', response.data);
// }
export function postFileJSON(target_url, tokenkey, tokenvalue, id, formdataname, responseFunction) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);
    myHeaders.append("Accept", "application/json");

    const input = document.getElementById(id);
    const file = input.files[0];
    const formData = new FormData();
    formData.append(formdataname, file);

    var requestOptions = {
        method: 'POST',
        body: formData,
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
    .then(response => response.text().then(data => ({
        status: response.status,
        data: data
    })))
    .then(result => {
        let parsed;
        try {
            parsed = JSON.parse(result.data);
        } catch (parseError) {
            parsed = null;
        }
        responseFunction({ status: result.status, data: parsed });
    })
    .catch(error => {
        console.log('error', error);
        responseFunction({ status: 0, data: null });
    })
    .finally(cancel);
}

// Mem-parse response.json() dengan aman - resolve ke null (bukan reject) kalau body-nya bukan JSON valid.
function safeJSON(response) {
    return response.json().catch(() => null);
}

//get file and download it into your browser, if not 200 then return json
export function getFileWithHeader(target_url, tokenkey, tokenvalue, responseFunction, fileName) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);

    let requestOptions = {
        method: 'GET',
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
        .then(response => {
            if (response.status === 200) {
                // Jika status 200, download file
                return response.blob().then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    //let base64fileurl = target_url.split('/').pop();
                    a.download = fileName; // Nama file dari URL
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                });
            } else {
                // Jika status selain 200, parse sebagai JSON
                return safeJSON(response).then(result => responseFunction(result));
            }
        })
        .catch(error => {
            console.log('error', error);
            responseFunction({ status: 0 });
        })
        .finally(cancel);
}

//get file bytes if 200, othen than return json
export function getFileBytesWithHeader(target_url, tokenkey, tokenvalue, responseFunction) {
    let myHeaders = new Headers();
    myHeaders.append(tokenkey, tokenvalue);

    let requestOptions = {
        method: 'GET',
        redirect: 'follow',
        headers: myHeaders
    };
    const { cancel } = withTimeout(requestOptions);

    fetch(target_url, requestOptions)
        .then(response => {
            if (response.status === 200) {
                // Jika status 200, return fileBytes
                return response.arrayBuffer().then(buffer => responseFunction(buffer));
            } else {
                // Jika status selain 200, parse sebagai JSON
                return safeJSON(response).then(result => responseFunction(result));
            }
        })
        .catch(error => {
            console.log('error', error);
            responseFunction({ status: 0 });
        })
        .finally(cancel);
}