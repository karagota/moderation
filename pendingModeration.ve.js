(function() {
    console.log('✅ pendingModeration.ve.js start');

    // Ожидаем инициализации VE
    const initInterval = setInterval(() => {
        if (window.ve && ve.ui && ve.ui.MWMediaDialog) {
            clearInterval(initInterval);
            applyPatches();
        }
    }, 100);

    function applyPatches() {
        console.log('✅ VE is ready, applying custom patches');

        // Сохраняем оригинальный метод
        const origSetup = ve.ui.MWMediaDialog.prototype.getSetupProcess;

        // Переопределяем процесс настройки
        ve.ui.MWMediaDialog.prototype.getSetupProcess = function(data) {
            return origSetup.call(this, data)
                .next(() => {
                    // Добавляем обработчики после инициализации
                    if (this.mediaUploadBooklet) {
                        console.log('✅ Attaching upload event handlers');

                        // Перехватываем создание объекта upload
                        const origCreateUpload = this.mediaUploadBooklet.createUpload;

                        this.mediaUploadBooklet.createUpload = function() {
                            const upload = origCreateUpload.call(this);
                            const booklet = this; // Сохраняем контекст BookletLayout

                            // Перехватываем метод finishStashUpload
                            const origFinishStashUpload = upload.finishStashUpload;

                            upload.finishStashUpload = function(filekey, filename) {
                                return origFinishStashUpload.call(this, filekey, filename)
                                    .then(response => {
                                        console.log('⚙️ Upload finished', response);

                                        // Если файл отправлен на модерацию
                                        if (response.upload && response.moderation === 'pending') {
                                            // Используем booklet.emit вместо this.emit
                                            booklet.emit('uploadModerated', response);
                                        }
                                        return response;
                                    })
                                    .catch(error => {
                                        console.log('⚙️ Upload error', error);

                                        // Если ошибка модерации
                                        if (error === 'moderation-image-queued') {
                                            // Используем booklet.emit вместо this.emit
                                            console.log(booklet.upload);
                                            booklet.emit('uploadModerated', {
                                                error: true,
                                                result: {
                                                    filename: booklet.upload.filename,
                                                    filekey: booklet.upload.stateDetails.errors[0].data.filekey || booklet.upload.stateDetails.errors[0].data.sessionkey
                                                }
                                            });
                                        }
                                        return Promise.reject(error);
                                    });
                            }.bind(upload);

                            return upload;
                        }.bind(this.mediaUploadBooklet);

                        // Обработчик для модерации
                        this.mediaUploadBooklet.on('uploadModerated', (response) => {
                            console.log('🔄 Upload moderated', response);

                            let data = {};

                            if (response.error) {
                                // Обработка ошибки
                                const errorData = response.result;
                                data = {
                                    fileName: errorData.filename,
                                    moderationTempUrl: 'https://wiki.test/images/thumb/0/00/%d0%af%d1%81%d1%84%d0%b2%d0%b0%d0%b2%d0%b0%d1%83%d1%86%d0%b0%d0%b9%d1%83.jpg/120px-%d0%af%d1%81%d1%84%d0%b2%d0%b0%d0%b2%d0%b0%d1%83%d1%86%d0%b0%d0%b9%d1%83.jpg' //+ errorData.filekey
                                };
                            } else {
                                // Обработка успешного ответа
                                data = {
                                    fileName: response.upload.filename,
                                    moderationTempUrl: response.moderationTempUrl
                                };
                            }

                            this.showPendingUpload(data);
                        });
                    }
                });
        };

        // Метод для показа интерфейса модерации
        ve.ui.MWMediaDialog.prototype.showPendingUpload = function(data) {
            console.log('🔄 Showing pending upload interface', data);

            console.log(this);

            // Переключаем на страницу информации
            this.switchPanels('imageInfo');

            // Очищаем контейнер
            this.$infoPanelWrapper.empty();

            // Создаем элементы интерфейса
            const $container = $('<div>').addClass('moderation-pending-container');

            // Превью файла
            if (data.moderationTempUrl) {
                $container.append(
                    $('<div>')
                        .css({textAlign: 'center', margin: '1em 0'})
                        .append(
                            $('<img>')
                                .attr('src', data.moderationTempUrl)
                                .css({maxWidth: '100%', maxHeight: '150px'})
                        )
                );
            }

            // Сообщение
            $container.append(
                $('<div>')
                    .addClass('moderation-pending-message')
                    .text('Ваш файл отправлен на модерацию')
            );

            // Кнопка (если есть имя файла)
            if (data.fileName) {
                $container.append(
                    $('<button>')
                        .addClass('oo-ui-buttonElement-button oo-ui-buttonElement-button-primary')
                        .text('Вставить ссылку')
                        .on('click', () => {
                            const surface = this.getFragment().getSurface();
                            surface.execute('insertContent', `[[File:${data.fileName}]]`);
                            this.close();
                        })
                );
            }

            // Добавляем в интерфейс
            this.$infoPanelWrapper.append($container);

            // Обновляем заголовок
            this.title.setLabel('Файл на модерации');
        };
    }
})();