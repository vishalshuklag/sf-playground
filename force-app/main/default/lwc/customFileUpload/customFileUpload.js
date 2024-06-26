import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import serverSaveFile from '@salesforce/apex/FilesUploadController.saveTheChunk';
import { RefreshEvent } from 'lightning/refresh';
import sendEmailWithAttachment from '@salesforce/apex/SendEmailWithAttachmnent.sendEmailWithAttachment';

export default class LightningMultiFileUpload extends LightningElement {

    @api recordId;
    @track isSpinner = false;
    @track fileNamesList = [];
    @track fileName = '';
    @track percent = 0;

    uploadableFilesContainer = [];
    MAX_FILE_SIZE = 4500000; //Max file size 4.5 MB 
    CHUNK_SIZE = 1000000;    //Chunk Max size 1 MB 

    // getting file 
    handleFilesChange(event) {
        let self = this;
        if (event.target.files.length > 0) {
            self.uploadableFilesContainer = [];
            self.fileNamesList = [];
            Array.prototype.forEach.call(event.target.files, function (file, index) {
                self.uploadableFilesContainer.push(file);
                self.fileNamesList.push({ serialNumber: (index + 1), name: file.name });
            });
        }
    }

    handleSave() {
        if (this.uploadableFilesContainer.length > 0) {
            let allAcceptableFile = true;
            let totalFiles = (this.uploadableFilesContainer.length - 1);
            this.uploadableFilesContainer.forEach((item, index) => {
                if (item.size > this.MAX_FILE_SIZE) {
                    allAcceptableFile = false;
                }
                if (totalFiles == index) {
                    this.validatefiles(allAcceptableFile);
                }
            });
        }
        else {
            this.showToast('Error', 'Please select file to upload!!', 'error');
        }
    }

    validatefiles(toAccept) {
        if (toAccept) {
            this.uploadHelper(0);
        } else {
            this.showToast('Error', 'Some files are more than 4 MB in size', 'error');
        }
    }

    uploadHelper(index) {
        let self = this;
        this.percent = 0
        let file = this.uploadableFilesContainer[index];

        let fileReader = new FileReader();
        fileReader.onloadend = (() => {
            let fileContents = fileReader.result;
            let base64 = 'base64,';
            let content = fileContents.indexOf(base64) + base64.length;
            fileContents = fileContents.substring(content);
            self.uploadProcess(index, fileContents);
        });
        fileReader.readAsDataURL(file);
    }

    uploadProcess(index, fileContent) {
        let fromPos = 0;
        let toPos = Math.min(fileContent.length, fromPos + this.CHUNK_SIZE);
        // start with the initial chunk, and set the attachId(last parameter)is null in begin
        this.saveToFile(index, fileContent, fromPos, toPos, '');
    }

    // Calling apex class to insert the file
    saveToFile(index, fileContent, startPosition, endPosition, attachId) {
        this.isSpinner = true;
        this.fileName = this.uploadableFilesContainer[index].name;

        let fileChunk = fileContent.substring(startPosition, endPosition);
        let params = {
            parentId: this.recordId,
            fileId: attachId,
            fileName: this.uploadableFilesContainer[index].name,
            contentType: this.uploadableFilesContainer[index].type,
            base64Data: encodeURIComponent(fileChunk)
        }

        serverSaveFile(params)
            .then(result => {
                attachId = result;
                this.percent = Math.round((endPosition / fileContent.length) * 100);
                // update the start position with end postion
                startPosition = endPosition;
                endPosition = Math.min(fileContent.length, startPosition + this.CHUNK_SIZE);
                if (startPosition < endPosition) {
                    this.saveToFile(index, fileContent, startPosition, endPosition, attachId);
                } else {
                    if (this.uploadableFilesContainer.length == (index + 1)) {
                        
                        this.showToast('Success!!', 'Files has been uploaded successfully!!!', 'success');
                        // Send Apex Email after File upload
                        this.sendEmail();
                        this.isSpinner = false;
                        this.spinnerMessage = '';
                    } else {
                        //Upload Next File
                        this.uploadHelper(index + 1);
                    }
                }

                // refresh the standard related list
                this.dispatchEvent(new RefreshEvent());
            })
            .catch(error => {
                // Showing errors if any while inserting the files
                this.isSpinner = false;
                this.spinnerMessage = '';
                window.console.log(error);
                this.showToast('Error while uploading File', error.message, 'error');
            });
    }

    async sendEmail() {
        let emailResults = await sendEmailWithAttachment({recordId : this.recordId, emailAddress: '01vishals@gmail.com'});

        if (emailResults.isSuccess) {
            this.showToast('Success','Email Sent successfully', 'success');
        } else {
            this.showToast('Error!', emailResults.errorMessage, 'error');
        }

    }

    showToast(t, m, v) {
        this.dispatchEvent(new ShowToastEvent({
            title: t,
            message: m,
            variant: v,
        }));
    }
}